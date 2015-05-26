# WebUI Using the SPO #



Virtually all operational control of a B5500 system was done through the supervisory keyboard/printer, or SPO.

The term "SPO" (pronounced "spoh") apparently comes from the Burroughs 220, a late-1950s vacuum-tube computer system that preceded the B5500. The 220 had a Supervisory Print Out instruction, the assembly-language mnemonic for which was SPO. This instruction would cause a specified number of words to be printed from memory to the system's console printer/keyboard.

Use of the term SPO persisted with Burroughs systems long after mechanical printer/keyboards were no longer used on the console and the operator interface transitioned to a video terminal. Modern Unisys MCP systems have for some time referred to the SPO as the Operator Display Terminal, or ODT.


# Background #

Initially on the B5000 and early B5500s, the SPO was a Smith-Corona electric typewriter, modified to interface with the system's I/O Control Units. Later, Burroughs switched to a Teletype Model 33 KSR device, with a panel of control buttons installed where a modem would normally be. This was termed the B495 Supervisory Printer. The best picture we have of the B495 comes from the [B100/200/300 Reference Manual](http://bitsavers.org/pdf/burroughs/1023850_B100-200-300ref.pdf):

> ![https://googledrive.com/host/0BxqKm7v4xBswRjNYQnpqM0ItbkU/B495-SPO-Image.png](https://googledrive.com/host/0BxqKm7v4xBswRjNYQnpqM0ItbkU/B495-SPO-Image.png)

The printer and control buttons look very similar to the interface we have developed for the web-based emulator:

> ![https://googledrive.com/host/0BxqKm7v4xBswRjNYQnpqM0ItbkU/B5500-SPO.png](https://googledrive.com/host/0BxqKm7v4xBswRjNYQnpqM0ItbkU/B5500-SPO.png)

The SPO was intended solely as an operational control device and not as a timesharing terminal. User programs could communicate with the SPO, but since the system typically ran multiple jobs at once, access to the SPO had to be shared on a non-conflicting basis. While it was possible to compile and run programs from the SPO (assuming the source or object code was already on disk), one did not sit at the SPO, for example, to edit source code.

The SPO was also a peripheral I/O device, and interfaced both physically and electronically to the rest of the system the same way that a tape drive or card reader would. It sat on the short end of the L-shaped operator console desk. Below it was a logic rack that adapted the Teletype interface signals to those of the system's I/O Units.

Since the SPO was very slow -- 10 characters/second -- and completely unbuffered, it tied up an I/O unit for the entire time that it was either printing or waiting for the operator to finish entering a message. There were a maximum of four I/O units on a system (three was a more typical number), so continuous SPO activity could have a significant impact on overall system I/O performance. The MCP went to some trouble to compress SPO output by stripping multiple blanks, and limited the number of output messages that could be queued for printing. There was also an operator command (`BK` or `<`mix`>BK`) to flush the SPO output queue for the whole system or a specified job.

In order to read from the SPO keyboard, the system must select an I/O unit and initiate a read operation. To signal the MCP when this is needed, there is a special Keyboard Request interrupt, triggered by the **INPUT REQUEST** button on the SPO control panel, as discussed below.


# SPO Control Panel #

The Model 33 teletype had a rotary off/local/remote switch on its front bezel, below the keyboard. This was typically left in the "remote" position unless the system was being powered down completely. The emulator does not implement this.

The Model 33 had a space on the right side of its case where interface equipment could be installed. This was often used for a dial modem. The units for the B5500 had a special panel installed in this space that had ten button/light controls in two columns of five. Three of the button/lights were blank and unused, although we have co-opted one for the "Algol Glyphs" feature discussed below. These controls are labeled as follows:

  * **POWER** -- this green light illuminates when power is applied to the unit. In the web-based emulator, it is always illuminated, and otherwise non-functional.
  * **READY** -- this yellow light illuminates when the system initiates a read operation in response to the **INPUT REQUEST** button being clicked.
  * **REMOTE** -- this yellow button/light indicates the unit is on-line to the rest of the system. If the unit is off-line, clicking the button makes it on-line.
  * **LOCAL** -- this yellow button/light indicates the unit is off-line to the rest of the system. If the unit is on-line, clicking the button makes it off-line. When the unit is off-line, you can type comments onto the paper, which will be printed but not transmitted to the system.
  * **INPUT REQUEST** this yellow button/light is used to raise the Keyboard Request interrupt. That interrupt in turn causes the MCP to initiate a read operation for the keyboard. When clicked, the button lights, and remains lit until the system initiates the read operation, at which point the light goes out, the **READY** light comes on, and the keyboard is enabled for input.
  * **END OF MESSAGE** -- after entering a command on the keyboard, click this yellow button to terminate input and signal the system that the command is complete. This also extinguishes the **READY** light.
  * **ERROR** -- if you made a mistake while entering a command, click this yellow button to cancel what had been entered. The MCP will discard your input to that point and reinitiate a read operation to the unit. To cancel a partially-entered command and not reenter it, click **ERROR**. Then when the **READY** light comes back on, click **END OF MESSAGE**.
  * **ALGOL GLYPHS** -- this yellow button/light was originally blank and unused. With the emulator, however, it is used to control whether the five special Algol characters are output as Unicode glyphs or as their ASCII substitutes. When the button is lit, the Algol characters are output as Unicode glyphs. Clicking the button toggles between the two output modes and converts existing glyphs on the "paper" between Unicode and ASCII as necessary. The default setting is taken from the current system configuration.

The ASCII substitutions for the five special Algol characters are:

  * `~` for left-arrow
  * `|` for the multiplication sign
  * `{` for less-than-or-equal
  * `}` for greater-than-or-equal
  * `!` for not-equal

You will never see the left-arrow glyph or its "`~`" substitute printed to the SPO. This character is used internally as an end-of-message marker. When the I/O Control Unit encounters the character in a buffer being output to the SPO, it terminates the data transfer and the "`~`" is not printed.

On input, typing a "`~`" character has the same effect as clicking the **END OF MESSAGE** button. The SPO will also interpret the underscore ("`_`") character the same as "`~`" on input.

The emulated SPO supports a few user-interface features that the Teletype Model 33 device did not:

  1. When the SPO window has the focus, you can press the **ESC** key instead of the **INPUT REQUEST** button to request input to the system. The **INPUT REQUEST** button will light as if it had been clicked.
  1. You can press the **Enter** key on your keyboard to end a message instead of clicking the **END OF MESSAGE** button.
  1. When the **READY** light is on and the SPO window has the focus, you can press the **ESC** key to cancel your input instead of clicking the **ERROR** button. In either case, the carriage will start a new line and the **READY** light will eventually come on again to allow you to reenter your command.
  1. Lower-case letters will be translated to upper case as you type them. Neither the B5500 nor the Model 33 supported lower case.
  1. When entering a command, you can press the **Backspace** key to correct errors. The Model 33 could not backspace.
  1. You can type faster than 10 characters/second, which was physically impossible with a Model 33.

The original implementation of the emulated SPO simply captured keystrokes from the SPO window, echoing them to the "paper" or activating control functions as necessary. This worked fine on workstations that have a keyboard, but it does not work at all on tablets that emulate a keyboard on their touch screen. Most tablet-based browsers only display the on-screen keyboard when the focus is in a text area or other control that accepts keyboard input. Without a text area, you can't get a keyboard, and without a keyboard, you can't send keystrokes to the SPO window, so input on a touch screen was not possible. Tablets with a physical keyboard would still work, however.

In order to support the touch interface of tablets, the SPO interface was changed in emulator version 1.00 to capture input using a standard text control instead of waiting for keystrokes to be directed to its window. When the system initiates a read to the SPO and the **READY** light illuminates, the SPO now enables a one-line text box at the bottom of the "paper" area. This text box is border-less, but does have a light-yellow background. As a bonus, the SPO now shows a cursor when you are entering text, and you can now do standard GIU editing and cut-and-paste during keyboard input. Once you signal end-of-message, the text box disappears and your input is transferred to the "paper" underneath it.

If you are using a keyboard, you can use the **ESC**, **Enter**, and **Backspace** keys as described above. If you are using a touch interface, you must click the **INPUT REQUEST** and **END OF MESSAGE** buttons to control SPO input.

A similar technique is now used when you click the **LOCAL** key to take the SPO off line. The same border-less text box will appear at the bottom of the "paper" area to accept your input. When you click **REMOTE**, the text box will disappear and its contents will be transferred to the "paper." If you press **Enter** or attempt to type more than 72 characters in the text box, the characters in the text box will be transferred to the "paper" and the text box cleared to accept more characters for the next line. When transitioning from **LOCAL** to **REMOTE** and the text box is non-empty, the text transferred to the "paper" will always be followed by a new-line.


# Tips for Using the SPO #

When the system is powered on and the SPO window opens, the SPO will print a short message indicating the emulator version. Please wait for this message to finish printing before attempting to click the **LOAD** button on the operator console. The **LOAD** button will not function until the SPO **REMOTE** light illuminates.

You may move and resize the SPO window, and minimize it, but _do not close the window_. The system will warn you if you attempt to do this. Closing the window will render the SPO inoperable until the emulator is reinitialized with the **POWER ON** button on the Operator Console.

When you resize the SPO window, the "paper" area will change size accordingly. If the window becomes too narrow for the current output, the output lines will be clipped on the right, although the output itself is unaffected and will reappear once the window is made larger. Below a certain minimum (and essentially usable) window size, the window contents will no longer resize and will be clipped.

The area representing the "paper" for the SPO has a 5000-line scrollback. Once this limit is reached, the earliest lines are deleted. You can copy portions of the text on the paper using ordinary click-and-drag functions of your pointing device.

Starting with release 1.00, the SPO "paper" is no longer implemented as an `<iframe>` element, so in most browsers it is no longer possible to save or print the contents of the paper directly. If you double-click anywhere in the text of the paper, however, the emulator will now open a temporary window and copy the entire contents of the "paper" to it. From there, you can save the text in a file, print it, or copy/paste it into another application. When you have finished with the temporary window, simply close it.


# An Overview of MCP SPO Commands #

The basic commands you will need to operate the B5500 emulator in a batch environment are listed below. This list does not include any of the data-communications or timesharing-specific commands. More complete documentation for the SPO commands and output messages can be found in documents on bitsavers.org:

  * [B5500 Handbook (April 1970)](http://www.bitsavers.org/pdf/burroughs/B5000_5500_5700/1031986_B5500_Handbook_Aug70.pdf) describes:
    * SPO commands starting on page 4-23
    * SPO output messages starting on page 4-1.
  * [B5500 Operation Manual (September 1968)](http://www.bitsavers.org/pdf/burroughs/B5000_5500_5700/1024916_B5500_B5700_OperMan_Sep68.pdf) has somewhat older information:
    * SPO commands starting on page C-40
    * SPO output messages starting on page C-1
  * [B5700 Timesharing System Manual (September 1972)](http://www.bitsavers.org/pdf/burroughs/B5000_5500_5700/1058583_B5700_TSS_RefMan_Sep72.pdf) has information relating to operation of the Timesharing MCP:
    * SPO commands starting on page 1-15

The B5500 MCP uses a terse set of operator commands based on two-letter mnemonic codes. Some commands consist only of their mnemonic code; other commands require operands after the mnemonic.

In the discussion below, the term _program_ refers to a codefile, i.e., an executable program file. The term _job_ refers to an instance of a program executing in "the mix" -- the collection of jobs currently executing in the system. A job can also be in the "schedule," which is where newly-submitted jobs reside until the MCP determines it has sufficient available memory to initiate the job in the mix. One program file can be associated with multiple jobs in the mix and/or the schedule at the same time.

Commands that affect a specific job in the system must be prefixed by that job's "mix number," a one- or two-digit integer assigned to the job by the MCP when the job initiates. This number is identified as "`<`mix`>`" in the descriptions below. Jobs in the schedule are assigned a "schedule index" by the MCP that is used similar to a mix number in SPO commands.

Peripheral units are referred to by a three letter mnemonic:

  * `SPO` -- the SPO
  * `CRA`, `CRB` -- card readers 1 and 2
  * `CDA`-`CD9` -- pseudo readers 1-32 (for spooled card decks -- letters `I` and `O`, and digits `0` and `1` not used)
  * `CPA` -- the card punch
  * `LPA`, `LPB` -- line printers 1 and 2
  * `MTA`-`MTT` -- magnetic tape units 1-16 (letters `G`, `I`, `O`, and `Q` not used)
  * `DCA` -- data communications adapter
  * `PRA`, `PRB` -- paper tape readers 1 and 2
  * `PPA`, `PPB` -- paper tape punches 1 and 2
  * `DKA`, `DKB` -- head-per-track disk control units 1 and 2
  * `DRA`, `DRB` -- drum units 1 and 2

If you enter an invalid SPO command, or one that has errors in its syntax or operands, the MCP typically responds with just `INV KBD` -- invalid keyboard entry.

| `<`mix`>AX`    | "Accept" -- reply to a COBOL `ACCEPT` statement, or a read on a file assigned to the SPO, that was executed by the specified mix index, e.g., `3AXNO`. The text following `AX`, after stripping any leading spaces, is made available to the program. |
|:---------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `<`mix`>BK`    | 'Break" -- clear messages queued to the SPO for the specified mix number, e.g., `5BK`. When used without a mix number, clears the SPO output queue for the entire system.                                                                             |
| `CC`           | "Control Card" -- enter control card syntax directly on the SPO. "`?`" can be used instead of `CC`. Semicolons (`;`) can be used to delimit multiple control statements on one line (72 character, max). A control statement may be continued across lines by ending a line with a "`-`". The continuation must be at the boundary between two syntactic tokens. The MCP will continue issuing reads to the SPO until either an `END` statement or a syntax error is encountered. |
| `CD`           | "Card Decks" -- list deck number and first card image of each "pseudo" card deck currently queued on disk by the `LDCNTRL/DISK` input spooler, e.g., `CD`.                                                                                            |
| `CI`           | "Change Intrinsics" -- switch the System Intrinsics library to a different file, e.g., `CI NEWINT/DISK`.                                                                                                                                              |
| `CL`           | "Clear Unit" -- reset the MCP status of the specified unit mnemonic (e.g., `CL CRA`, `CL MTB`) and DS-es (aborts) any job to which the unit is currently assigned. In the case of card readers, the MCP will read and ignore all cards until the next `?END` card is encountered. |
| `<`mix`>CT`    | "Change Times" -- change the processor and I/O time limits for the specified mix number, e.g., "`3CT 300,60`". The integers specify limits for processor and I/O time, respectively, in seconds. Either time may be omitted, but the comma is required if the I/O time is specified. |
| `<`mix`>CU`    | "Core Usage" -- display memory use in words for the specified mix number, e.g., `3CU`. When used without a mix number, displays memory use for all jobs in the system.                                                                                |
| `<`mix`>DS`    | "Discontinue" -- abort the job with the specified mix number, e.g. `2DS`. Pronounced "DEE-ess."                                                                                                                                                       |
| `DT`           | "Date" -- change the system date, e.g., `DT 7/20/83`. The date must be written in month/day/year format, using either "`/`" or "`-`" as a delimiter between the date parts. The year must be two digits, and will be interpreted as a 1900-relative year, as the B5500 was not Y2K-compliant. But then, almost nothing else in the '60s was, either. |
| `ED`           | "Eliminate Deck" -- discard a spooled card deck that has been assigned to the specified pseudo reader, e.g., `ED CDA`.                                                                                                                                |
| `<`mix`>ES`    | "Eliminate from Schedule" -- terminate a job that has been scheduled but not yet begun execution. `DS` cannot be used in this case because the job is in the schedule, not yet in the mix. The mix number is actually a schedule index, e.g., `3ES`.  |
| `<`mix`>FM`    | "Form Message" -- reply to a `#FM RQD` message when output is to be printed on special forms by assigning a printer to the specified mix number, e.g., `5FM LPA`. Presumably the operator previously loaded the necessary forms into that printer.    |
| `<`mix`>FR`    | "Final Reel" -- reply to a `#NO FIL` message for an unlabeled tape file to inform the system that no more reels of tape are to be read, e.g., `4FR`. This causes the job for the specified mix number to receive an EOF result on the pending read.   |
| `<`mix`>IL`    | "Ignore Label" -- reply to a `#NO FIL` or `#DUP FIL` message when the system cannot find a peripheral unit with media labeled to match the file name requested by the job with the specified mix number. Assigns a specified unit to that job regardless of how the media on that unit is labeled, e.g., `3IL MTB` or `2ILCRA`. |
| `<`mix`>IN`    | "Insert Number" -- store a one-word binary unsigned integer value into a PRT location (designated in octal) for the specified mix number, e.g., `4IN 25=33`. This was typically used to asynchronously supply a dynamic parameter to a job, but the job had to sample the PRT location periodically in order to get the value. |
| `LD`           | "Load Decks" -- initiate the `LDCNTRL/DISK` input spooler to read decks from a card reader or magnetic tape labeled `CONTROL/DECK` and store them either on disk or another magnetic tape for ultimate use by a pseudo reader. `LD DK` stores decks on disk; `LD MT` stores decks on tape. See [Using the Card Reader](WebUIUsingTheCardReader.md) for more information on how to label a card reader for use with this command. |
| `LN`           | "Log New" -- transfer the contents of the `SYSTEM/LOG` file to a new file, e.g., `LN`. The new file is named _mmddccc_`/SYSLOG`, where _mm_ is the current month, _dd_ is the current date of month, and _ccc_ is a log sequence number assigned by the MCP. |
| `MX`           | "Mix" -- list all of the jobs currently running in the mix, e.g., `MX`. Each job is listed as _p_`:`_mfid_`/`_fid_`=`_mm_, where _p_ is the priority (0=highest, 9=lowest), _mfid_`/`_fid_ is the program name, and _mm_ is the mix number.           |
| `<`mix`>OF`    | "Optional File" -- reply to a `#NO FIL` message from a COBOL job when the requested file is not present and will not be provided to the job, e.g., `7OF`. This causes the `OPEN` statement in the COBOL program to succeed and for the program to receive an EOF result on the first read of the file. |
| `<`mix`>OK`    | "Okay, Try Again" -- reply to a job that has been suspended by the operator, or is waiting for some resource, such as a file or available space on disk, to be made available, e.g., `4OK`. If the program was suspended by the operator with a `ST` command, it resumes execution. If the program was suspended due to an unavailable resource, the system checks again for the resource. If it is available, the program resumes execution, otherwise it remains suspended. The system typically recognizes newly-available resources and resumes suspended programs automatically, so this command is seldom necessary except to resume after an `ST` command. |
| `OL`           | "Observe Label" -- display the current status of the specified peripheral unit, including the name of any media currently mounted on it, e.g., `OL MTD`.                                                                                              |
| `<`mix`>OT`    | "Output Value" -- display the value of a PRT location (specified in octal) for the specified mix number, e.g., `3OT26`. The first location available for variables declared in a program was octal 25. When compiling a program, `OT25` indicates the number of syntax errors encountered thus far. For most compilers, `OT27` indicates the sequence number of the record currently being parsed by the compiler. |
| `<`mix`>OU`    | "Output Unit" -- reply to a `#LP RQD` or `#LP PBT MT RQD` message from the specified mix number to supply the physical output medium for a job's printer file if the `PBDONLY` option is not set and no line printer is currently available, e.g., `5OU MT` for a printer-backup tape. |
| `PB`           | "Print Backup" -- initiate printing of printer or punch data that has been spooled to disk or tape, e.g., `PB MTC` for a printer-backup tape, or `PB 231` for a backup file on disk. Printer- and punch-backup files on disk are named `PBD/`_nnnnsss_ and `PUD/`_nnnnsss_, respectively, where _nnnn_ is a backup-file number assigned by the MCP and _sss_ is a sequence number also assigned by the MCP. The _nnnn_ number is the one used with a `PB` command. Large printer files were broken up into multiple physical files on disk, all having the same _nnnn_ value but different _sss_ values. The MCP automatically prints all files having the same _nnnn_ value. |
| `PD`           | "Print Directory" -- list the names of files on disk matching the pattern specified by the operand. Disk files have two-level names, termed the multiple-file ID (MFID) and file ID (FID). Possible search patterns are `PD `_mfid_`/`_fid_, `PD `_mfid_`/=` (or `PD `_mfid_`=` or just `PD `_mfid_), `PD =/`_fid_ (or `PD =`_fid_), or `PD =/=` (or just `PD =`). Note that this is not a full wildcard search -- the _mfid_ or _fid_ must be a complete name. |
| `PG`           | "Purge" -- purge a magnetic tape volume (reel) by writing a "scratch" label on it, and optionally assign a five-digit volume number in the process, e.g., `PG MTA` or `PG MTD-12345`, where `12345` is the volume number and the dash (with no spaces surrounding it) is required. |
| `<`mix`>PR`    | "Priority" -- change the priority of a job in the mix, e.g., `4PR=6`. The highest priority is 0 and the lowest is 9.                                                                                                                                  |
| `<`mix`>PS`    | "Priority in Schedule" -- change the priority of a job that is in the schedule, similar to the `PR` command, e.g., `5PS=7`. The mix number is actually a schedule index.                                                                              |
| `QT`           | "Quit Output" -- stop printing or punching the spooled file being output to the designated peripheral unit, e.g., `QT LPB` or `QT CPA`. Can also be entered with the mix number of the spooler job, e.g., `3QT`. The backup file on disk or tape is not purged. Printing of the file is merely terminated, and the file may be reprinted at a later time using the `PB` command. |
| `RD`           | "Remove Decks" -- removes spooled card decks from disk if they have not yet been assigned to a pseudo reader. The decks are identified by their deck number, as displayed by the `CD` command, e.g., `RD #203, #207, #216`.                           |
| `<`mix`>RM`    | "Remove" -- resolve a duplicate-file condition, where a job is attempting to lock a new file into the disk directory, but a file of the same name already exists on disk. If the command is entered in response to this condition (e.g., `3RM`), the existing file on disk will be replaced by the new one. The alternative is to `DS` the job, which will leave the existing file in place. |
| `RN`           | "Reader Number" -- set the number of active pseudo readers (input card-deck de-spoolers) for the system, e.g., `RN 2`. Setting the number to zero inhibits further decks from being de-spooled. Can also be entered with a deck number, e.g., `RN #204`, to load the specified deck into a pseudo reader. This latter form is normally used only with shared-disk systems. |
| `RO`           | "Reset Option" -- reset one of the MCP options, e.g., `RO USE AUTOPRNT`                                                                                                                                                                               |
| `RW`           | "Rewind Unit" -- rewind and logically "lock" the tape drive designated by the operand, e.g., `RW MTB`. The unit must not currently be assigned to a job. A "locked" unit cannot be assigned to a job by the system until either the operator enters an `RY` command referencing the unit, or the unit is made not-ready and then ready again (so that the MCP would sense the status change). `RW` was often used to keep the system from using a mounted scratch tape until the operator was ready for it to be assigned to a specific job. |
| `RY`           | "Ready Unit" -- force the MCP to recognize a change in the status of the designated units, as if the units had been made not-ready and then ready again, so that the MCP would sense the status change, e.g., `RY MTD`, `RY CRA`. Readying a card reader that has been labeled but not yet opened by a program causes the `LABEL` or `?DATA` card to be ignored. `RY` is also used to ready a unit saved with the `SV` command. |
| `SF`           | "Set Factor" -- set the Multiprocessing Factor for the system, a real number with at most two digits before and two digits after the decimal point, e.g., `SF 1.25`. This is essentially a fudge factor by which the amount of available physical memory is multiplied when the MCP is determining whether a job can be moved out of the schedule and into the mix. |
| `SO`           | "Set Option" -- set one of the MCP options, e.g., `SO USE TIME`                                                                                                                                                                                       |
| `<`mix`>ST`    | "Suspend Task" -- suspend the job for the specified mix number, e.g., `5ST`. The job stays in the mix, but does not consume any processor time. The job may be resumed with an `OK` command or terminated with a `DS` command.                        |
| `SV`           | "Save Unit" -- mark a peripheral unit as unavailable for assignment to a job. If the unit is currently assigned to a job, it becomes unavailable for further assignment when it is released by that job. Saved units can be made ready again with the `RY` command. |
| `TF`           | "Type Factor" -- display the current Multiprocessing Factor as set by the `SF` command.                                                                                                                                                               |
| `<`mix`>TI`    | "Times" -- display the running times for the job with the specified mix number, e.g., `3TI`. The processor, I/O (channel), and elapsed times, respectively, are displayed in _hours_:_minutes_:_seconds_ format, e.g., `CP= 1:41, IO= 8 IN 1:44`      |
| `<`mix`>TL`    | "Time Limits" -- display the processor and I/O time limits for the job with the specified mix limit, e.g., `5TL`.                                                                                                                                     |
| `TO`           | "Type Options" -- list all of the MCP run-time options and their current setting, e.g., `TO`.                                                                                                                                                         |
| `TR`           | "Time Reset" -- set the system time of day in 24-hour notation, e.g., `TR 1345`.                                                                                                                                                                      |
| `TS`           | "Type Schedule" -- list all jobs currently in the schedule, e.g., `TS`.                                                                                                                                                                               |
| `<`mix`>UL`    | "Unlabeled" -- reply to a `#NO FIL` message and assign a peripheral unit with unlabeled media to the job with the specified mix number, e.g., `4UL MTD`.                                                                                              |
| `WD`           | "What Date" -- display the current system date, e.g., `WD`.                                                                                                                                                                                           |
| `WI`           | "What Intrinsics" -- display the name of the current System Intrinsics file being used by the system, e.g., `WI`.                                                                                                                                     |
| `WM`           | "What MCP" -- display the name of the current MCP file being used with the system and the compile-time options that are enabled for it, e.g., `WM`.                                                                                                   |
| `WT`           | "What Time" -- display the current time of day, e.g., `WT`.                                                                                                                                                                                           |
| `<`mix`>WY`    | "Why Stopped" -- display the reason that the job with the specified mix index has suspended execution and the command mnemonics the MCP will accept to resolve the suspension, e.g., `5WY`. When used without a mix number, displays all of the jobs that are suspended and waiting for operator intervention. |
| `<`mix`>XS`    | "Execute from Schedule" -- force the job with the specified mix number from the schedule into the running mix, even though the MCP does not think it has sufficient memory to run that job, e.g., `2XS`. The mix number is actually a schedule index. |
| `<`mix`>XT`    | "Extend Times" -- extend the time limits for the job with the specified mix index, e.g., `5XT 360,190`. This command is similar to `CT`, but specifies the new limits relative to the existing ones, instead of setting absolute limits. The times are specified in seconds for the processor and I/O limits, respectively. Either time may be omitted, but if the I/O time is specified, it must be preceded by a comma. |