# WebUI Using the Card Punch #



The B5500 supported a couple of card punch models, with speeds ranging from 100 to 300 cards per minute. A B5500 system could have one card punch, identified as `CPA`.


# Background #

The card punch interface we have developed for the web-based emulator is modeled after the 300 card-per-minute B304. This interface opens in a separate window when the **POWER ON** button is activated on the emulator console:

> ![https://googledrive.com/host/0BxqKm7v4xBswRjNYQnpqM0ItbkU/B5500-CardPunch.png](https://googledrive.com/host/0BxqKm7v4xBswRjNYQnpqM0ItbkU/B5500-CardPunch.png)

The B304 had additional buttons and lamps related to the mechanical issues of punching cards (e.g., feed and punch check indicators), but these controls are not relevant to operation under the emulator.

The unit had three output stackers, primary (Stacker 1), auxiliary (Stacker 2) and error. The error stacker was used for cards detected to be in error after punching, cards left in the punch area too long and ejected automatically by the unit, and "runout" cards that were manually cleared from the feed path. The error stacker is not modeled by the emulator.

Stackers 1 and 2 each have an output capacity of 850 cards. When either stacker becomes "full" (i.e., the number of cards reaches that limit), the unit goes into a not-ready state.

The last few cards punched to each stacker are shown in text areas on the window for the card punch user interface. Each line of text represents one card. You can virtually remove "cards" from the "stacker" by selecting and copying lines of text from these areas and then pasting them into another application, such as a text editor, from which they can be saved to your local file system. This copy/paste technique is the only reasonably convenient way to capture data from the punch unit.

Cards can be punched only in alpha mode, i.e., ordinary alphanumeric keypunch hole patterns. Binary punching is not supported by the B304. Lines are composed using the emulator's version of the B5500 64-character set:

```
    0 1 2 3 4 5 6 7
    8 9 # @ ? : > {
    + A B C D E F G
    H I . [ & ( < ~
    | J K L M N O P
    Q R $ * - 0 ; {
      / S T U V W X
    Y Z , % ! = } "
```

The B5500 used five special Algol characters that do not have ASCII equivalents. The emulator uses the following ASCII substitutions for them:

  * `~` for left-arrow
  * `|` for the multiplication sign
  * `{` for less-than-or-equal
  * `}` for greater-than-or-equal
  * `!` for not-equal

As an option, the punch will render the special Algol characters using their appropriate Unicode glyphs. See below for instructions on how to enable and disable this feature. The five Unicode glyphs are:

  * U+00D7: small-cross (multiplication sign)
  * U+2190: left-arrow
  * U+2260: not-equal
  * U+2264: less-than-or-equal
  * U+2265: greater-than-or-equal


# Card Punch Control Panel #

The user interface for the emulated card punch consists of the following controls and indicators:

  * **NOT READY** -- this white indicator illuminates when the punch is in a not-ready status. The punch becomes ready when the **START** button is clicked. It becomes not-ready when the **STOP** button is clicked or when either output stacker becomes full.
  * **RUNOUT** -- This red button/indicator is used to "empty" the output stackers of the punch. This is a different use than the button had on the B304 punch unit. The button only responds to clicks when the punch is in a not-ready status. Clicking the button in a not-ready status toggles the state of the button. When this button is activated (the indicator is lit), clicking the **START** button will display a confirmation box asking if it is okay to empty both stackers of the punch. If you reply OK, the lines of text in both stackers will be erased and the punch will be placed in a ready status. If you want to capture the data for the cards from either of the stackers, you much select and copy their lines of text before emptying the stacker.
  * **STOP** -- clicking this red button will stop the punch and place it in a not-ready status. The **NOT READY** button will illuminate.
  * **START** -- clicking this green button will place the punch in a ready status. The **NOT READY** lamp will go out. The MCP should sense the status change within a second or two and begin (or resume) punching cards if any I/Os to the punch are currently queued.

Below the buttons are text areas and progress bars for each stacker. These show the relative number of cards currently in each output stacker. Each time you empty the stackers, this bar resets all the way to the left. As cards are punched, the length of the bar will increase towards to right in proportion to the number of cards in the output stacker.

Below each progress bar, the text areas show the last card images that were punched for each stacker.

In the upper-right of the unit's window is a checkbox labeled **ALGOL GLYPHS**. When this box is checked, the five special Algol characters will be rendered using their Unicode glyphs. When the box is unchecked, those characters will be rendered using their ASCII substitutions, as described above. Toggling the checkbox will convert the characters in the stacker text areas between Unicode glyphs and the ASCII substitution glyphs. The initial setting for this checkbox is taken from the "Algol Glyphs" setting for the punch in the current system configuration.

Below the checkbox are two annunciators, "`STACKER 1 FULL`" and "`STACKER 2 FULL`" that will illuminate when their respective stacker reaches its output-hopper limit. These annunciators will go off when the stackers are cleared.

# Operating the Card Punch #

As mentioned above, you can stop the punch at any time and make it not-ready by clicking the **STOP** button. Restart it by clicking the **START** button. Whenever the punch is stopped and in a not-ready status, you can copy/paste the lines of text from a stacker and/or clear both stackers using the **RUNOUT** button.

When either stacker limit is reached, the punch will stop and go not-ready. You can determine which stacker is full by examining their respective stacker progress bars, but an annunciator in the upper-right of the unit's window will also illuminate to indicate the problem. Clicking the **START** button will allow one additional card to be punched, then the unit will go not-ready again.

To resume continuous operation of the punch, you must clear the stackers. As described above, with the unit in a not-ready state, click the **RUNOUT** button, then the **START** button, and reply to the confirmation box. Once the stackers are empty, click the **START** button again to resume punching.