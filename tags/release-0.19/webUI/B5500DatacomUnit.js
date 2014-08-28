/***********************************************************************
* retro-b5500/emulator B5500DatacomUnit.js
************************************************************************
* Copyright (c) 2012, Nigel Williams and Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* B5500 Datacom Peripheral Unit module.
*
* Defines a Datacom peripheral unit type that implements:
*   - The B249 Data Transmission Control Unit (DTCU), with
*   - A single B487 Data Transmission Terminal Unit (DTTU), having
*   - A single type 980 (teletype) adapter with a 112-character buffer.
*
* The user interface emulates a simple teletype device, similar to the SPO.
*
* Note that the results from the DCA are unusual, in that the terminal unit
* (TU) and buffer numbers are returned in [8:10] of the error mask.
*
************************************************************************
* 2013-10-19  P.Kimpel
*   Original version, cloned from B5500SPOUnit.js.
***********************************************************************/
"use strict";

/**************************************/
function B5500DatacomUnit(mnemonic, unitIndex, designate, statusChange, signal) {
    /* Constructor for the DatacomUnit object */

    this.maxScrollLines = 1500;         // Maximum amount of printer scrollback
    this.charPeriod = 100;              // Printer speed, milliseconds per character
    this.bufferSize = 112;              // 4 28-character B487 buffer segments

    this.mnemonic = mnemonic;           // Unit mnemonic
    this.unitIndex = unitIndex;         // Ready-mask bit number
    this.designate = designate;         // IOD unit designate number
    this.statusChange = statusChange;   // external function to call for ready-status change
    this.signal = signal;               // external function to call for special signals (e.g,. Datacom inquiry request)

    this.buffer = new ArrayBuffer(448); // adapter buffer storage
    this.initiateStamp = 0;             // timestamp of last initiation (set by IOUnit)
    this.inTimer = null;                // input setCallback() token
    this.outTimer = null;               // output setCallback() token

    this.clear();

    this.window = window.open("", mnemonic);
    if (this.window) {
        this.shutDown();                // destroy any previously-existing window
        this.window = null;
    }
    this.doc = null;
    this.paper = null;
    this.endOfPaper = null;
    this.window = window.open("../webUI/B5500DatacomUnit.html", mnemonic,
            "scrollbars,resizable,width=580,height=540");
    this.window.moveTo((screen.availWidth-this.window.outerWidth)/2, (screen.availHeight-this.window.outerHeight)/2);
    this.window.addEventListener("load", B5500CentralControl.bindMethod(B5500DatacomUnit.prototype.datacomOnload, this), false);
}

// this.bufState enumerations
B5500DatacomUnit.prototype.bufNotReady = 0;
B5500DatacomUnit.prototype.bufIdle = 1;
B5500DatacomUnit.prototype.bufInputBusy = 2;
B5500DatacomUnit.prototype.bufReadReady = 3;
B5500DatacomUnit.prototype.bufOutputBusy = 4;
B5500DatacomUnit.prototype.bufWriteReady = 5;

B5500DatacomUnit.prototype.keyFilter = [    // Filter keyCode values to valid BCL ones
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,  // 00-0F
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,  // 10-1F
        0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x00,0x28,0x29,0x2A,0x2B,0x2C,0x2D,0x2E,0x2F,  // 20-2F
        0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,0x3A,0x3B,0x00,0x3D,0x00,0x3F,  // 30-3F
        0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4A,0x4B,0x4C,0x4D,0x4E,0x4F,  // 40-4F
        0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5A,0x5B,0x00,0x5D,0x00,0x00,  // 50-5F
        0x00,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4A,0x4B,0x4C,0x4D,0x4E,0x4F,  // 60-6F
        0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5A,0x7B,0x7C,0x7D,0x7E,0x00]; // 70-7F

/**************************************/
B5500DatacomUnit.prototype.$$ = function $$(e) {
    return this.doc.getElementById(e);
};

/**************************************/
B5500DatacomUnit.prototype.clear = function clear() {
    /* Initializes (and if necessary, creates) the datacom unit state */

    this.ready = false;                 // ready status
    this.busy = false;                  // busy status

    this.abnormal = false;              // buffer in abnormal state
    this.bufIndex = 0;                  // current offset into buffer
    this.bufLength = 0;                 // current buffer length
    this.connected = false;             // buffer/adapter is currently connected
    this.errorMask = 0;                 // error mask for finish()
    this.finish = null;                 // external function to call for I/O completion
    this.fullBuffer = false;            // buffer is full (unterminated)
    this.interrupt = false;             // buffer in interrupt state
    this.nextCharTime = 0;              // next output character time
    this.printCol = 0;                  // current printer column

    this.bufState = this.bufNotReady;   // Current state of datacom buffer
};

/**************************************/
B5500DatacomUnit.prototype.hasClass = function hasClass(e, name) {
    /* returns true if element "e" has class "name" in its class list */
    var classes = e.className;

    if (!e) {
        return false;
    } else if (classes == name) {
        return true;
    } else {
        return (classes.search("\\b" + name + "\\b") >= 0);
    }
};

/**************************************/
B5500DatacomUnit.prototype.addClass = function addClass(e, name) {
    /* Adds a class "name" to the element "e"s class list */

    if (!this.hasClass(e, name)) {
        e.className += (" " + name);
    }
};

/**************************************/
B5500DatacomUnit.prototype.removeClass = function removeClass(e, name) {
    /* Removes the class "name" from the element "e"s class list */

    e.className = e.className.replace(new RegExp("\\b" + name + "\\b\\s*", "g"), "");
};

/**************************************/
B5500DatacomUnit.prototype.showBufferIndex = function showBufferIndex() {
    /* Formats the buffer index and length, and the column counter, for display */

    this.$$("BufferOffset").innerHTML = this.bufIndex.toString();
    this.$$("BufferLength").innerHTML = this.bufLength.toString();
    this.$$("PrintColumn").innerHTML = (this.printCol+1).toString();
};

/**************************************/
B5500DatacomUnit.prototype.setState = function setState(newState) {
    /* Sets a new state in this.bufState and updates the annunciators appropriately */

    this.showBufferIndex();

    if (this.abnormal) {
        this.addClass(this.$$("Abnormal"), "textLit")
    } else {
        this.removeClass(this.$$("Abnormal"), "textLit");
    }

    if (this.interrupt) {
        this.addClass(this.$$("Interrupt"), "textLit")
    } else {
        this.removeClass(this.$$("Interrupt"), "textLit");
    }

    if (this.fullBuffer) {
        this.addClass(this.$$("FullBuffer"), "textLit")
    } else {
        this.removeClass(this.$$("FullBuffer"), "textLit");
    }

    if (this.bufState != newState) {
        switch (this.bufState) {
        case this.bufNotReady:
            this.removeClass(this.$$("NotReadyState"), "textLit");
            break;
        case this.bufIdle:
            this.removeClass(this.$$("IdleState"), "textLit");
            break;
        case this.bufInputBusy:
            this.removeClass(this.$$("InputBusyState"), "textLit");
            break;
        case this.bufReadReady:
            this.removeClass(this.$$("ReadReadyState"), "textLit");
            break;
        case this.bufOutputBusy:
            this.removeClass(this.$$("OutputBusyState"), "textLit");
            break;
        case this.bufWriteReady:
            this.removeClass(this.$$("WriteReadyState"), "textLit");
            break;
        }

        switch (newState) {
        case this.bufNotReady:
            this.addClass(this.$$("NotReadyState"), "textLit");
            break;
        case this.bufIdle:
            this.addClass(this.$$("IdleState"), "textLit");
            break;
        case this.bufInputBusy:
            this.addClass(this.$$("InputBusyState"), "textLit");
            break;
        case this.bufReadReady:
            this.addClass(this.$$("ReadReadyState"), "textLit");
            break;
        case this.bufOutputBusy:
            this.addClass(this.$$("OutputBusyState"), "textLit");
            break;
        case this.bufWriteReady:
            this.addClass(this.$$("WriteReadyState"), "textLit");
            break;
        }

        this.bufState = newState;
    }
};

/**************************************/
B5500DatacomUnit.prototype.termDisconnect = function termDisconnect() {
    /* Sets the status of the datacom unit to disconnected */

    if (this.connected) {
        this.bufLength = 0;
        this.bufIndex = 0;
        this.removeClass(this.$$("TermConnectBtn"), "greenLit");
        this.interrupt = true;
        this.abnormal = true;
        this.setState(this.bufIdle);
        this.signal();
        this.connected = false;
    }
};

/**************************************/
B5500DatacomUnit.prototype.termConnect = function termConnect() {
    /* Sets the status of the datacom unit to connected */

    if (!this.connected) {
        this.addClass(this.$$("TermConnectBtn"), "greenLit");
        this.interrupt = true;
        this.abnormal = true;
        this.setState(this.bufWriteReady);
        this.signal();
        this.connected = true;
    }
};

/**************************************/
B5500DatacomUnit.prototype.appendEmptyLine = function appendEmptyLine() {
    /* Removes excess lines already printed, then appends a new <pre> element
    to the <iframe>, creating an empty text node inside the new element */
    var count = this.paper.childNodes.length;

    while (count-- > this.maxScrollLines) {
        this.paper.removeChild(this.paper.firstChild);
    }
    this.paper.lastChild.nodeValue += String.fromCharCode(0x0A);        // newline
    this.endOfPaper.scrollIntoView();
    this.paper.appendChild(this.doc.createTextNode(""));
};

/**************************************/
B5500DatacomUnit.prototype.backspaceChar = function backspaceChar() {
    /* Handles backspace for datacom buffer input */
    var line = this.paper.lastChild;

    if (this.bufLength > 0) {
        this.bufIndex--;
        this.showBufferIndex();
    }
};

/**************************************/
B5500DatacomUnit.prototype.printChar = function printChar(c) {
    /* Echoes the character code "c" to the terminal display */
    var col = this.printCol;
    var line = this.paper.lastChild.nodeValue;
    var len = line.length;

    if (col < 72) {
        while (len < col) {
            line += " ";
            len++;
        }
        if (len > col) {
            line = line.substring(0, col) + String.fromCharCode(c) + line.substring(col+1);
        } else {
            line += String.fromCharCode(c);
        }
        this.printCol++;
    } else {
         line = line.substring(0, 71) + String.fromCharCode(c);
    }
    this.paper.lastChild.nodeValue = line;
};

/**************************************/
B5500DatacomUnit.prototype.outputChar = function outputChar() {
    /* Outputs one character from the buffer to the terminal display. If more characters remain
    to be printed, schedules itself 100 ms later to print the next one, otherwise
    calls finished(). If the column counter exceeds 72, the last character over-types.
    Note that Group Mark (left-arrow) detection is done by IOUnit in preparing the buffer */
    var c;
    var delay;
    var nextTime;
    var stamp;

    if (this.bufIndex < this.bufLength) {
        stamp = new Date().getTime();
        nextTime = (this.nextCharTime < stamp ? stamp : this.nextCharTime) + this.charPeriod;
        delay = nextTime - stamp;
        this.nextCharTime = nextTime;

        c = this.buffer[this.bufIndex++];
        switch (c) {
        case 0x7B:      // { less-or-equal, output CR
            this.printCol = 0;
            this.outTimer = setCallback(this.outputChar, this, delay);
            break;
        case 0x21:      // ! not-equal, output LF
            this.appendEmptyLine();
            this.outTimer = setCallback(this.outputChar, this, delay);
            break;
        case 0x3C:      // < less-than, output RO (DEL)
        case 0x3E:      // > greater-than, output X-ON (DC1)
            this.outTimer = setCallback(this.outputChar, this, delay);
            break;              // do nothing, just delay
        case 0x7D:      // } greater-or-equal, disconnect
            this.termDisconnect();
            break;
        default:
            this.printChar(c);
            this.outTimer = setCallback(this.outputChar, this, delay);
            break;
        }
        this.showBufferIndex();
    } else {
        this.interrupt = true;
        this.setState(this.fullBuffer ? this.bufWriteReady : this.bufIdle);
        this.signal();
    }
};

/**************************************/
B5500DatacomUnit.prototype.terminateInput = function terminateInput() {
    /* Handles the End of Message event */

    this.interrupt = true;
    this.setState(this.bufReadReady);
    this.signal();
};

/**************************************/
B5500DatacomUnit.prototype.keyPress = function keyPress(ev) {
    /* Handles keyboard character events. Depending on the state of the buffer,
    either buffers the character for transmission to the I/O Unit, echos
    it to the printer, or ignores it altogether */
    var c = ev.charCode;
    var delay;
    var index = this.bufLength;
    var nextTime;
    var stamp;

    //this.$$("CharCode").innerHTML = c.toString() + ":0x" + c.toString(16);

    if (this.connected) {
        stamp = new Date().getTime();
        if (this.bufState == this.bufIdle) {
            this.bufIndex = this.bufLength = 0;
            this.nextCharTime = stamp;
        }

        nextTime = this.nextCharTime + this.charPeriod;
        delay = nextTime - stamp;

        if (c == 0) {
            switch(ev.keyCode) {
            case 0x08:
                c = 0x3C;               // BS: force Backspace key
                break;
            case 0x0D:
                c = 0x7E;               // Enter: force ~ (GM) for end-of-message
                break;
            }
        } else if (ev.ctrlKey) {
            switch(c) {
            case 0x42:
            case 0x62:
                c = 0x02;               // Ctrl-B: force STX, break
                break;
            case 0x45:
            case 0x65:
                c = 0x05;               // Ctrl-E:force ENQ, WRU
                break;
            case 0x4C:
            case 0x6C:
                c = 0x0C;               // Ctrl-L: force FF, clear input buffer
                break;
            case 0x51:
            case 0x71:
                c = 0x7E;               // Ctrl-Q: DC1, X-ON to ~ (GM) for end-of-message
                break;
            default:
                c = 0;                  // not something we want
                break;
            }
        }

        if (this.bufState == this.bufReadReady && this.fullBuffer) {
            this.interrupt = true;
            this.setState(this.bufInputBusy);
            setCallback(this.signal, this, delay);      // buffer overflow
            ev.stopPropagation();
            ev.preventDefault();
        } else if (this.bufState == this.bufInputBusy || this.bufState == this.bufIdle) {
            switch (c) {
            case 0x7E:                  // ~ left-arrow (Group Mark), end of message
                this.inTimer = setCallback(this.printChar, this, delay, c);
                this.nextCharTime = this.charPeriod + nextTime;
                setCallback(this.terminateInput, this, this.charPeriod+delay);
                ev.stopPropagation();
                ev.preventDefault();
                break;
            case 0x3C:                  // <, backspace
                if (this.bufIndex > 0) {
                    this.bufIndex--;
                }
                this.inTimer = setCallback(this.printChar, this, delay, c);
                this.nextCharTime = nextTime;
                ev.stopPropagation();
                ev.preventDefault();
                break;
            case 0x21:                  // ! EOT, disconnect
                this.buffer[this.bufIndex++] = 0x7D;    // } greater-or-equal code
                this.interrupt = true;
                this.abnomal = true;
                this.setState(this.bufReadReady);
                setCallback(this.signal, this, delay);
                this.inTimer = setCallback(this.printChar, this, delay, c);
                this.nextCharTime = nextTime;
                ev.stopPropagation();
                ev.preventDefault();
                break;
            case 0x02:                  // Ctrl-B, STX, break on input
                this.bufIndex = this.bufLength = 0;
                this.setState(this.bufIdle);
                ev.stopPropagation();
                ev.preventDefault();
                break;
            case 0x05:                  // Ctrl-E, ENQ, who-are-you (WRU)
                if (this.bufState == this.bufIdle || this.bufState == this.bufInputBusy) {
                    this.interrupt = true;
                    this.abnormal = true;
                    this.setState(this.bufWriteReady);
                    setCallback(this.signal, this, delay);
                }
                ev.stopPropagation();
                ev.preventDefault();
                break;
            case 0x0C:                  // Ctrl-L, FF, clear input buffer
                if (this.bufState == this.bufInputBusy) {
                    this.bufIndex = this.bufLength = 0;
                }
                ev.stopPropagation();
                ev.preventDefault();
                break;
            case 0x3F:                  // ? question-mark, set abnormal for control message
                this.abnormal = true;
                this.setState(this.bufState);       // just to turn on the annunciator
                // no break
            default:
                c = this.keyFilter[c];
                if (c) {                // if it's a character we will accept
                    this.buffer[this.bufIndex++] = c;
                    this.inTimer = setCallback(this.printChar, this, delay, c);
                    this.nextCharTime = nextTime;
                    if (this.bufIndex < this.bufferSize) {
                        this.setState(this.bufInputBusy);
                    } else {
                        this.interrupt = true;
                        this.fullBuffer = true;
                        this.setState(this.bufReadReady);
                        setCallback(this.signal, this, this.charPeriod+delay);  // full buffer, no GM detected
                    }
                    ev.stopPropagation();
                    ev.preventDefault();
                }
                break;
            } // switch c
        } else if (this.bufState == this.bufOutputBusy) {
            if (c == 0x02) {            // Ctrl-B, STX, break on output
                this.interrupt = true;
                this.abnormal = true;
                this.setState(this.bufReadReady);
                setCallback(this.signal, this, delay);
                ev.stopPropagation();
                ev.preventDefault();
            }
        }
    }
};

/**************************************/
B5500DatacomUnit.prototype.termConnectBtnClick = function termConnectBtnClick(ev) {

    if (this.connected) {
        this.termDisconnect();
    } else {
        this.termConnect();
    }
    ev.target.blur();                   // move focus off the Connect btn
    this.paper.focus();
};

/**************************************/
B5500DatacomUnit.prototype.beforeUnload = function beforeUnload(ev) {
    var msg = "Closing this window will make the device unusable.\n" +
              "Suggest you stay on the page and minimize this window instead";

    ev.preventDefault();
    ev.returnValue = msg;
    return msg;
};

/**************************************/
B5500DatacomUnit.prototype.datacomOnload = function datacomOnload() {
    /* Initializes the datacom unit and terminal window user interface */
    var x;

    this.doc = this.window.document;
    this.doc.title = "retro-B5500 " + this.mnemonic + ": TU/BUF=01/00";
    this.paper = this.doc.createElement("pre");
    this.paper.appendChild(this.doc.createTextNode(""));
    this.$$("TermOut").contentDocument.body.appendChild(this.paper);
    this.endOfPaper = this.doc.createElement("div");
    this.endOfPaper.appendChild(this.doc.createTextNode("\xA0"));
    this.$$("TermOut").contentDocument.body.appendChild(this.endOfPaper);
    this.$$("TermOut").contentDocument.head.innerHTML += "<style>" +
            "BODY {background-color: white} " +
            "PRE {margin: 0; font-size: 8pt; font-family: Lucida Sans Typewriter, Courier New, Courier, monospace}" +
            "</style>";

    this.window.focus();
    this.nextCharTime = new Date().getTime();

    this.window.addEventListener("beforeunload", this.beforeUnload, false);

    this.window.addEventListener("keypress", B5500CentralControl.bindMethod(B5500DatacomUnit.prototype.keyPress, this), false);
    this.$$("TermOut").contentDocument.body.addEventListener("keypress", B5500CentralControl.bindMethod(B5500DatacomUnit.prototype.keyPress, this), false);

    this.$$("TermConnectBtn").addEventListener("click", B5500CentralControl.bindMethod(B5500DatacomUnit.prototype.termConnectBtnClick, this), false);

    for (x=0; x<32; x++) {
        this.appendEmptyLine();
    }
    this.statusChange(1);               // make DCA ready
};

/**************************************/
B5500DatacomUnit.prototype.read = function read(finish, buffer, length, mode, control) {
    /* Initiates a read operation on the unit. "control" is the TU/BUF# */
    var actualLength = 0;
    var bufNr;
    var tuNr;
    var transparent;
    var x;

    this.errorMask = 0x100 + (mode & 0x01)*0x800; // set the read [24:1] and mode [21:1] bits in the mask
    bufNr = control % 0x10;
    transparent = (control % 0x20) >>> 4;
    tuNr = (control % 0x200) >>> 5;

    switch (true) {
    case tuNr != 1:
    case bufNr != 0:
        this.errorMask |= 0x34;         // not this TU/BUF -- set buffer not ready
        break;
    case !this.connected:
        this.errorMask |= 0x34;         // not connected -- set buffer not ready
        break;
    case this.bufState == this.bufReadReady:
        // Copy the adapter buffer to the IOUnit buffer
        actualLength = (transparent ? this.bufferSize : this.bufIndex);
        for (x=0; x<actualLength; x++) {
            buffer[x] = this.buffer[x];
        }

        // Set the state bits in the result and reset the adapter to idle
        if (this.abnormal) {
            this.errorMask |= 0x200;    // set abnormal bit
        }
        if (this.fullBuffer || transparent) {
            this.errorMask |= 0x80;     // set no-GM/buffer-exhausted bit
        }
        this.bufIndex = this.bufLength = 0;
        this.interrupt = false;
        this.abnormal = false;
        this.fullBuffer = false;
        this.setState(this.bufIdle);
        break;
    case this.bufState == this.bufWriteReady:
        this.errorMask |= 0x20;         // attempt to read a write-ready buffer
        break;
    case this.bufState == this.bufInputBusy:
    case this.bufState == this.bufOutputBusy:
        this.errorMask |= 0x30;         // buffer busy
        break;
    default:
        this.errorMask |= 0x34;         // buffer idle or not ready
        break;
    } // switch (true)

    this.errorMask += bufNr*0x40000000 + tuNr*0x800000000;

    //console.log(this.mnemonic + " Read:  " + control.toString(8) + ":" + this.errorMask.toString(8) + " (" +
    //    actualLength + ") " + (actualLength ? String.fromCharCode.apply(null, buffer.subarray(0, actualLength)) : 0));

    finish(this.errorMask, actualLength);
};

/**************************************/
B5500DatacomUnit.prototype.space = function space(finish, length, control) {
    /* Initiates a space operation on the unit */

    finish(0x04, 0);                    // report unit not ready
};

/**************************************/
B5500DatacomUnit.prototype.write = function write(finish, buffer, length, mode, control) {
    /* Initiates a write operation on the unit. "control" is the TU/BUF# */
    var actualLength = 0;
    var bufNr;
    var tuNr;
    var transparent;
    var x;

    this.errorMask = (mode & 0x01)*0x800; // set the mode [21:1] bit in the mask
    bufNr = control % 0x10;
    transparent = (control % 0x20) >>> 4;
    tuNr = (control % 0x200) >>> 5;

    switch (true) {
    case tuNr != 1:
    case bufNr != 0:
        this.errorMask |= 0x34;         // not this TU/BUF -- buffer not ready
        break;
    case !this.connected:
        this.errorMask |= 0x34;         // not connected -- buffer not ready
        break;
    case this.bufState == this.bufIdle:
    case this.bufState == this.bufWriteReady:
        // Copy the IOUnit buffer to the adapter buffer
        if (transparent) {
            actualLength = this.bufferSize;
            this.fullBuffer = false;    // or should it be true for transparent?
        } else if (length < this.bufferSize) {
            actualLength = length;
            this.fullBuffer = false;
        } else {
            actualLength = this.bufferSize;
            this.fullBuffer = true;
        }
        for (x=0; x<actualLength; x++) {
            this.buffer[x] = buffer[x];
        }

        // Set the state bits in the result and start printing
        if (this.abnormal) {
            this.errorMask |= 0x200;    // set abnormal bit
        }
        if (this.fullBuffer || transparent) {
            this.errorMask |= 0x80;     // set no-GM/buffer-exhausted bit
        }
        this.bufIndex = 0;
        this.bufLength = actualLength;
        this.interrupt = false;
        this.abnormal = false;
        this.setState(this.bufOutputBusy);
        this.nextCharTime = this.initiateStamp;
        this.outputChar();              // start the printing process
        break;
    case this.bufState == this.bufReadReady:
        this.errorMask |= 0x20;         // attempt to write a read-ready buffer
        break;
    case this.bufState == this.bufInputBusy:
    case this.bufState == this.bufOutputBusy:
        this.errorMask |= 0x30;         // buffer busy
        break;
    default:
        this.errorMask |= 0x34;         // buffer not ready
        break;
    } // switch (true)

    this.errorMask += bufNr*0x40000000 + tuNr*0x800000000;

    //console.log(this.mnemonic + " Write: " + control.toString(8) + ":" + this.errorMask.toString(8) + " (" +
    //    actualLength + ") " + (actualLength ? String.fromCharCode.apply(null, buffer.subarray(0, actualLength)) : ""));

    finish(this.errorMask, actualLength);
};

/**************************************/
B5500DatacomUnit.prototype.erase = function erase(finish, length) {
    /* Initiates an erase operation on the unit */

    finish(0x04, 0);                    // report unit not ready
};

/**************************************/
B5500DatacomUnit.prototype.rewind = function rewind(finish) {
    /* Initiates a rewind operation on the unit */

    finish(0x04, 0);                    // report unit not ready
};

/**************************************/
B5500DatacomUnit.prototype.readCheck = function readCheck(finish, length, control) {
    /* Initiates a read check operation on the unit */

    finish(0x04, 0);                    // report unit not ready
};

/**************************************/
B5500DatacomUnit.prototype.readInterrogate = function readInterrogate(finish, control) {
    /* Initiates a read interrogate operation on the unit */

    finish(0x04, 0);                    // report unit not ready
};

/**************************************/
B5500DatacomUnit.prototype.writeInterrogate = function writeInterrogate(finish, control) {
    /* Initiates a write interrogate operation on the unit. "control" is the TU/BUF# */
    var bufNr;
    var tuNr;

    this.errorMask = 0;                 // default result is idle
    bufNr = control % 0x10;
    tuNr = (control % 0x200) >>> 5;

    if (tuNr > 1) {
        this.errorMask |= 0x34;         // not a valid TU/BUF -- report not ready
    } else if (tuNr == 1 && bufNr > 0) {
        this.errorMask |= 0x34          // not a valid BUF for TU#1 -- report not ready
    } else if (tuNr == 0) {
        if (this.interrupt) {
            tuNr = 1;
            bufNr = 0;
        }
    }

    if (tuNr == 1 && bufNr == 0) {
        switch (this.bufState) {
        case this.bufReadReady:
            this.errorMask |= 0x100;
            break;
        case this.bufWriteReady:
            this.errorMask |= 0x20;
            break;
        case this.bufInputBusy:
        case this.bufOUtputBusy:
            this.errorMask |= 0x10;
            break;
        case this.bufIdle:
            // default value, no action
            break;
        default:
            this.errorMask |= 0x14;     // report not ready
            break;
        } // switch (this.bufState)

        if (this.abnormal) {
            this.errorMask |= 0x200;    // set abnormal bit
        }
        this.interrupt = false;
        this.setState(this.bufState);
    }

    this.errorMask += bufNr*0x40000000 + tuNr*0x800000000;

    //console.log(this.mnemonic + " W-Int: " + control.toString(8) + ":" + this.errorMask.toString(8));

    finish(this.errorMask, 0);
};

/**************************************/
B5500DatacomUnit.prototype.shutDown = function shutDown() {
    /* Shuts down the device */

    if (this.inTimer) {
        clearTimeout(this.inTimer);
    }
    if (this.outTimer) {
        clearTimeout(this.outTimer);
    }
    this.window.removeEventListener("beforeunload", this.beforeUnload, false);
    this.window.close();
};