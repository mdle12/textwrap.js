const expandTabs = (text, size=8) => {
    return text.replace(/\t/, " ".repeat(size));
};

const translate = (text, table) => {
    for (var [f, s] of Object.entries(table)) {
        text = text.replace(String.fromCharCode(f), String.fromCharCode(s));
    }
    return text;
};

const any = (arr, pred) => {
    var outcome = false;
    arr.forEach(elem => outcome = outcome || pred(elem));
    return outcome;
};

const map = (arr, pred) => {
    var outcome = [];
    arr.forEach(elem => outcome.push(pred(elem)));
    return outcome;
};

const sum = (iter, start=0) => {
    var outcome = start;
    iter.forEach(elem => outcome += elem);
    return outcome;
};

const zip = (arr1, arr2) => {
    return arr1.map((e, i) => [e, arr2[i]]);
};

/**
 * Object for wrapping/filling text. The public interface consists of the wrap() and
 * fill() methods; the other methods are just there for subclasses to override in order
 * to tweak the default behaviour. If you want to completely replace the main wrapping
 * algorithm, you'll probably have to override _wrap_chunks().
 * 
 * Several instance attributes control various aspects of wrapping:
 *   width (default: 70)
 *     the maximum width of wrapped lines (unless break_long_words is false)
 *   initial_indent (default: "")
 *     string that will be prepended to the first line of wrapped output. Counts
 *     towards the line's width.
 *   subsequent_indent (default: "")
 *     string that will be prepended to all lines save the first of wrapped output; also
 *     counts towards each line's width.
 *   expand_tabs (default: true)
 *     expand tabs in input text to spaces before further processing. Each tab will
 *     become 0 .. 'tabsize' spaces, depending on its position in its line. If false,
 *     each tab is treated as a single character.
 *   tabsize (default: 8)
 *     expand tabs in input text to 0 .. 'tabsize' spaces, unless 'expand_tabs' is false
 *   replace_whitespace (default: true)
 *     replace all whitespace characters in the input text by spaces after tab
 *     expansion. Note that if expand_tabs is false and replace_whitespace is true,
 *     every tab will be converted to a single space
 *   fix_sentence_endings (default: false)
 *     ensure that sentence-ending punctuation is always followed by two spaces. Off by
 *     default because the algorithm is (unavoidably) imperfect.
 *   break_long_words (default: true)
 *     break words longer than 'width'. If false, those words will not be broken, and
 *     some lines might be longer than 'width'.
 *   break_on_hyphens (default: true)
 *     allow breaking hyphenated words. If true, wrapping will occur preferably on
 *     whitespaces and right after hyphens part of compounds words.
 *   drop_whitespace (default: true)
 *     drop leading and trailing whitespace from lines.
 *   options['max_lines'] (default: null)
 *     truncate wrapped lines
 *   options['placeholder'] (default: ' [...]')
 *     append to the last line of truncated text
 */
class TextWrapper {
    unicode_whitespace_trans = {9: 32, 10: 32, 11: 32, 12: 32, 13: 32, 32: 32};

    // this affront to god will split text up into word-wrappable chunks
    wordsep_re = /([\t\n\x0b\x0c\r ]+|(?<=[\w!"'&.,?]) -{2,} (?=\w)|[^\t\n\x0b\x0c\r ]+? (?:-(?: (?<=[^\d\W]{2}-) | (?<=[^\d\W]-[^\d\W]-))(?= [^\d\W] -? [^\d\W])|(?=[\t\n\x0b\x0c\r ]|\Z)|(?<=[\w!"'&.,?]) (?=-{2,}\w)))/;
    // this less of an affront will just split on recognized spaces
    wordsep_simple_re = /([\t\n\x0b\x0c\r]+)/;

    sentence_end_re = /[a-z][.!?]["']?\Z/;

    constructor({width=70, initial_indent="", subsequent_indent="", expand_tabs=true,
                replace_whitespace=true, fix_sentence_endings=false,
                break_long_words=true, drop_whitespace=true, break_on_hyphens=true,
                tabsize=8, max_lines=null, placeholder=' [...]'} = {}) {

        this.width = width;
        this.initial_indent = initial_indent;
        this.subsequent_indent = subsequent_indent;
        this.expand_tabs = expand_tabs;
        this.replace_whitespace = replace_whitespace;
        this.fix_sentence_endings = fix_sentence_endings;
        this.break_long_words = break_long_words;
        this.drop_whitespace = drop_whitespace;
        this.break_on_hyphens = break_on_hyphens;
        this.tabsize = tabsize;
        this.max_lines = max_lines;
        this.placeholder = placeholder;
    }

    // private methods (possibly useful for subclasses to override)

    /**
     * Munge whitespace in text: expand tabs and convert all other whitespace
     * characters to spaces.
     * 
     * @param {string} text 
     * @returns {string}
     */
    _munge_whitespace(text) {
        if (this.expand_tabs) text = expandTabs(text, this.tabsize);
        if (this.replace_whitespace) text = translate(text, this.unicode_whitespace_trans);
        return text;
    }

    /**
     * Split the text to wrap into indivisible chunks. Chunks are not quite the same as
     * words; see _wrap_chunks() for full details.
     * 
     * @param {string} text 
     * @returns {[string]}
     */
    _split(text) {
        if (this.break_on_hyphens) {
            var chunks = text.split(this.wordsep_re);
        } else {
            var chunks = text.split(this.wordsep_simple_re);
        }
        return chunks.filter(c => c);
    }

    /**
     * Correct for sentence endings buried in 'chunks'.
     * 
     * @param {[string]} chunks 
     */
    _fix_sentence_endings(chunks) {
        var i = 0;
        while (i < chunks.length - 1) {
            if (chunks[i + 1] == " " && chunks[i].match(this.sentence_end_re)) {
                chunks[i + 1] = "  ";
                i += 2;
            } else {
                i++;
            }
        }
    }

    /**
     * Handle a chunk of text (most likely a word, not whitespace) that is too long to
     * fit in any line.
     * 
     * @param {[string]} reversed_chunks 
     * @param {[string]} cur_line 
     * @param {number} cur_len 
     * @param {number} width 
     */
    _handle_long_word(reversed_chunks, cur_line, cur_len, width) {
        // figure out when indent is larger than the specified width, and make sure at
        // least one character is stripped off on every pass
        if (width < 1) {
            var space_left = 1;
        } else {
            var space_left = width - cur_len;
        }

        // if we're allowed to break long words, then do so: put as much of the next
        // chunk onto the current line as will fit
        if (this.break_long_words) {
            var end = space_left;
            var chunk = reversed_chunks[reversed_chunks.length - 1];
            if (this.break_on_hyphens && chunk.length > space_left) {
                // break after last hyphen, but only if there are non-hyphens before it
                var hyphen = chunk.substring(0, space_left).lastIndexOf('-');
                if (hyphen > 0 && any(chunk.substring(0, hyphen).split(''), c => c != '-')) {
                    var end = hyphen + 1;
                }
            }
            cur_line.push(chunk.substring(0, end));
            reversed_chunks[reversed_chunks.length - 1] = chunk.substring(end);
        } else if (this.cur_line.length == 0) {
            // otherwise, we have to preserve the long word intact. Only add it to the
            // current line if there's nothing already there -- that minimizes how much
            // we violate the width constraint.
            cur_line.push(reversed_chunks.pop());
        }

        // if we're not allowed to break long words, and there's already text on the
        // current line, do nothing. Next time through the main loop of _wrap_chunks(),
        // we'll wind up here again, but cur_len will be 0, so the next line will be
        // entirely devoted to the long word that we can't handle right now.
    }

    /**
     * Wrap a sequence of text chunks and return a list of lines of length 'this.width'
     * or less. (If 'break_long_words' is false, some lines may be longer than this.)
     * Chunks correspond roughly to words and the whitespace between them: each chunk is
     * indivisible (modulo 'break_long_words'), but a line break can come between any
     * two chunks. Chunks should not have internal whitespace; ie. a chunk is either all
     * whitespace or a "word". Whitespace chunks will be removed from the beginning and
     * end of lines, but apart from that whitespace is preserved.
     * 
     * @param {[string]} chunks 
     * @returns {[string]}
     */
    _wrap_chunks(chunks) {
        var lines = [];
        if (this.width <= 0) {
            throw new Error(`invalid width ${this.width} (must be > 0)`);
        }
        if (this.max_lines != null) {
            if (this.max_lines > 1) {
                var indent = this.subsequent_indent;
            } else {
                var indent = this.initial_indent;
            }
            if ((indent.length + this.placeholder.trimStart().length) > this.width) {
                throw new Error("placeholder too large for max width");
            }
        }

        // arrange in reverse order so items can be efficiently popped from a stack of
        // chunks
        chunks = chunks.reverse();

        while (chunks.length != 0) {
            // start the list of chunks that will make up the current line
            // cur_len is just the length of all the chunks in cur_line
            var cur_line = [];
            var cur_len = 0;

            // figure out which static string will prefix this line
            if (lines.length != 0) {
                var indent = this.subsequent_indent;
            } else {
                var indent = this.initial_indent;
            }

            // maximum width for this line
            var width = this.width - indent.length;

            // first chunk on line is whitespace -- drop it, unless this is the very
            // beginning of the text (ie. no lines started yet).
            if (this.drop_whitespace && chunks[chunks.length - 1].trim() == '' && lines.length != 0) {
                chunks.pop();
            }

            while (chunks.length != 0) {
                var l = chunks[chunks.length - 1].length;

                // can at least squeeze this chunk onto the current line
                if (cur_len + l <= width) {
                    cur_line.push(chunks.pop());
                    cur_len += l;
                } else {
                    // this line is full
                    break;
                }
            }

            // the current line is full, and the next chunk is too big to fit on *any*
            // line (not just this one)
            if (chunks.length != 0 && chunks[chunks.length - 1].length > width) {
                this._handle_long_word(chunks, cur_line, cur_len, width);
                var cur_len = sum(map(cur_line, l => l.length));
            }

            // if the last chunk on this line is all whitespace, drop it.
            if (this.drop_whitespace && cur_line.length != 0 && cur_line[cur_line.length - 1].trim() == '') {
                cur_len -= cur_line[cur_line.length - 1].length;
                cur_line.pop();
            }

            if (cur_line.length != 0) {
                if (this.max_lines == null ||
                        lines.length + 1 < this.max_lines ||
                        (chunks.length == 0 || this.drop_whitespace && chunks.length == 1 && chunks[0].trim() == '')
                        && cur_len <= width) {
                    // convert current line back to a string and store it in list of all
                    // lines (return value)
                    lines.push(indent + cur_line.join(''));
                } else {
                    var flag = false;
                    while (cur_line.length != 0) {
                        if (cur_line[cur_line.length - 1].trim() != '' &&
                                cur_len + this.placeholder.length <= width) {
                            cur_line.push(this.placeholder);
                            lines.push(indent + cur_line.join(''));
                            flag = true;
                            break;
                        }
                        cur_len -= cur_line[cur_line.length - 1].length;
                        cur_line.pop();
                    }
                    if (flag) break;
                    if (lines.length != 0) {
                        var prev_line = lines[lines.length - 1].trimEnd();
                        if ((prev_line.length + this.placeholder.length) <= this.width) {
                            lines[lines.length - 1] = prev_line + this.placeholder;
                            break;
                        }
                        lines.push(indent + this.placeholder.trimEnd());
                    }
                    break;
                }
            }
        }

        return lines;
    }

    _split_chunks(text) {
        return this._split(this._munge_whitespace(text));
    }

    // public interface

    /**
     * Reformat the single paragraph in 'text' so it fits in lines of no more than
     * 'self.width' columns, and return a list of wrapped lines. Tabs in 'text' are
     * expanded with expandTabs, and all other whitespace characters
     * (including newline) are converted to spaces.
     * 
     * @param {string} text 
     * @returns {[string]}
     */
    wrap(text) {
        var chunks = this._split_chunks(text);
        if (this.fix_sentence_endings) this._fix_sentence_endings(chunks);
        return this._wrap_chunks(chunks);
    }

    /**
     * Reformat the single paragraph in 'text' to fit in lines of no more than
     * 'this.width' columns, and return a new string containing the entire wrapped
     * paragraph.
     * 
     * @param {string} text 
     * @returns {string}
     */
    fill(text) {
        return this.wrap(text).join("\n");
    }
}

// convenience interfaces

/**
 * Wrap a single paragraph of text, returning a list of wrapped lines.
 * 
 * Reformat the single paragraph in 'text' so that it fits in lines of no more than
 * 'width' columns, and return a list of wrapped lines. By default, tabs in 'text' are
 * expanded with expandTabs, and all other whitespace characters (including newline) are
 * converted to spaces. See the TextWrapper class for available keyword args to customize
 * wrapping behaviour.
 */
function wrap(text, width=70, options={}) {
    return new TextWrapper({width, ...options}).wrap(text);
}

/**
 * Fill a single paragraph of text, returning a new string.
 * 
 * Reformat the single paragraph in 'text' to fit in lines of no more than 'width'
 * columns, and return a new string containing the entire wrapped paragraph. As with
 * wrap(), tabs are expanded and other whitespace characters are converted to spaces.
 * See the TextWrapper class for available keyword args to customize wrapping behaviour.
 */
function fill(text, width=70, options={}) {
    return new TextWrapper({width: width, ...options}).fill(text);
}

/**
 * Collapse and truncate the given text to fit in the given width.
 * 
 * The text first has its whitespace collapsed. If it then fits in the *width*, it is
 * returned as is. Otherwise, as many words as possible are joined and then the
 * placeholder is appended::
 * 
 * > textwrap.shorten("Hello  world!", 12)
 * 'Hello world!'
 * > textwrap.shorten("Hello  world!", 11)
 * 'Hello [...]'
 */
function shorten(text, width, options={}) {
    return new TextWrapper({width: width, max_lines: 1, ...options}).fill(text.trim().split(" ").filter(e => e).join(' '));
}

// loosely related functionality

const _whitespace_only_re = /^[ \t]+$/m;
const _leading_whitespace_re = /(^[ \t]*)(?:[^ \t\n])/gm;

/**
 * Remove any common leading whitespace from every line in `text`.
 * 
 * This can be used to make triple-quoted strings line up with the left edge of the
 * display, while still presenting them in the source code in indented form.
 * 
 * Note that tabs and spaces are both treated as whitespace, but they are not equal:
 * the lines "  hello" and "\\thello" are considered to have no common leading whitespace
 * 
 * Entirely blank lines are normalized to a newline character.
 */
function dedent(text) {
    // look for the longest leading string of spaces and tabs common to all lines.
    var margin;
    text = text.replace(_whitespace_only_re, '');
    var indents = text.match(_leading_whitespace_re);
    for (var indent of indents) {
        indent = indent.substring(0, indent.length - 1);
        if (margin == null) {
            var margin = indent;
        } else if (indent.startsWith(margin)) {
            // current line more deeply indented than previous winner: no change
            // (previous winner is still on top)
            continue;
        } else if (margin.startsWith(indent)) {
            // current line consistent with and no deeper than previous winner: it's
            // the new winner
            var margin = indent;
        } else {
            // find the largest common whitespace between current line and previous
            // winner.
            var z = zip(margin.split(''), indent.split(''));
            for (var i = 0; i < z.length; i++) {
                var [x, y] = z[i];
                if (x != y) {
                    var margin = margin.substring(0, i);
                    break;
                }
            }
        }
    }

    // sanity check (testing/debugging only)
    if (false && margin.length != 0) {
        for (var line of text.split("\n")) {
            if (line.length == 0 || line.startsWith(margin)) throw new Error(`line=${line}, margin=${margin}`);
        }
    }

    if (margin != null) text = text.replace(new RegExp('^' + margin, 'gm'), '');
    return text;
}

/**
 * Adds 'prefix' to the beginning of selected lines in 'text'.
 * 
 * If 'predicate' is provided, 'prefix' will only be added to the lines where
 * 'predicate(line)' is true. If 'predicate' is not provided, it will default to
 * adding 'prefix' to all non-empty lines that do not consist solely of whitespace
 * characters.
 */
function indent(text, prefix, predicate=null) {
    if (predicate == null) predicate = (line) => line.trim() != '';

    var lines = [];
    for (var line of text.split(/\r?\n|\r|\n/g)) {
        //if (line == '') continue;
        line += '\n';
        if (predicate(line)) {
            lines.push(prefix + line)
        } else {
            lines.push(line);
        }
    }
    return lines.join('').slice(0, -1);
}

module.exports = {
    TextWrapper,
    wrap,
    fill,
    shorten,
    dedent,
    indent
};