# textwrap.js

An implementation of Python's textwrap module in JavaScript.

For a more detailed documentation, see [the original Python documentation](https://docs.python.org/3/library/textwrap.html).

## Examples

### wrap

```js
const textwrap = require('textwrap.js')
var value = "This function wraps the input paragraph such that each line in the paragraph is at most width characters long. The wrap method returns a list of output lines. The returned list is empty if the wrapped output has no content."

var wrapper = new textwrap.TextWrapper({width: 50})
var word_list = wrapper.wrap(value)

for (var element of word_list) console.log(element)
/*
Output:
This function wraps the input paragraph such that
each line in the paragraph is at most width
characters long. The wrap method returns a list of
output lines. The returned list is empty if the
wrapped output has no content.
*/
```

### fill

```js
const textwrap = require('textwrap.js')
var value = "This function returns the answer as STRING and not LIST."

var wrapper = textwrap.TextWrapper({width: 50})
var string = wrapper.fill(value)

console.log(string)
/*
This function returns the answer as STRING and not
LIST.
*/
```

### dedent

```js
const textwrap = require('textwrap.js')

var s = "    hello\n      world\n    "
console.log(s)
/*
    hello
      world
*/

var text = textwrap.dedent(s)
console.log(text)
/*
hello
  world
*/
```

### shorten

```js
const textwrap = require('textwrap.js')

var sample_text = "This function wraps the input paragraph such that each line in the paragraph is at most width characters long. The wrap method returns a list of output lines. The returned list is empty if the wrapped output has no content."

var wrapper = textwrap.TextWrapper({width: 50})

var dedented_text = textwrap.dedent(sample_text)
var original = wrapper.fill(dedented_text)

console.log(`Original:\n${original}`)
/*
Original:
This function wraps the input paragraph such that
each line in the paragraph is at most width
characters long. The wrap method returns a list of
output lines. The returned list is empty if the
wrapped output has no content.
*/

var shortened = textwrap.shorten(original, 100)
var shortened_wrapped = wrapper.fill(shortened)

console.log(`\nShortened:\n${shortened_wrapped}`)
/*
Shortened:
This function wraps the input paragraph such that
each line in the paragraph is at most width [...]
*/
```

### indent

```js
const textwrap = require('textwrap.js')

var s = "hello\n\n \nworld"
var s1 = textwrap.indent(s, ' ')

console.log(`${s}\n`)
/*
hello
     
     
world
*/

console.log(`${s1}\n`)
/*
 hello


 world
*/

var s2 = textwrap.indent(s, '+ ', line => true)

console.log(s2)
/*
+ hello
+
+
+ world
*/
```