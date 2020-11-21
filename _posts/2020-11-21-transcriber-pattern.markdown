---
layout: post
title: "The Transcriber pattern"
date: "2020-11-20 21:00:00 +0300"
categories: programming python
---
## Introduction

I would like to share a small and very easy to write class that has helped me
in the past a lot. It can help greatly when transcribing one piece of text to
another, applying some transformation along the way. Without further ado:

```python
class Transcriber:
    def __init__(self, source):
        self.source = source
        self.destination = []
        self.ptr = 0

    # Copy
    def copy_until(self, until):
        self.destination.append(self.source[self.ptr:until])
        self.ptr = until

    def copy(self, length):
        self.copy_until(self.ptr + length)

    def copy_until_end(self):
        self.copy_until(-1)

    # Skip
    def skip_until(self, until):
        self.ptr = until

    def skip(self, length):
        self.skip_until(self.ptr + length)

    # Add
    def add(self, text):
        self.destination.append(text)

    def get_destination(self):
        return "".join(self.destination)
```

## First example

Lets see it in action. Here we replace all lines that contain the word 'error'
to uppercase:

```python
def capitalize_error(source):
    transcriber = Transcriber(source)
    for line in source.splitlines():
        if 'error' in line:
            transcriber.add(line.upper())
            transcriber.skip(len(line))
        else:
            transcriber.copy(len(line))
        transcriber.copy(1)  # Copy the '\n'
    return transcriber.get_destination()

print(capitalize_error("""
line one
line two
line three with error
line four
""".strip()))

# <<< line one
# <<< line two
# <<< LINE THREE WITH ERROR
# <<< line four
```

## Explanation

To describe what this does with text (should probably be a docstring), we could
say:

> Monitors the gradual transcription of `source` to `destination`. During the
> process, you can copy or skip chunks of `source` and interject your own
> chunks.

As is frequent with pieces of code I am fond of, the nice thing about the
`Transcriber` is not that it does something very complicated or clever. Rather,
it exposes an interface that abstracts something very tedious, allowing you to
write good-looking and unobscure code.

So, the idea is that you initialize the `Transcriber` object with a `source`
argument. Then you inspect the contents of `source` in parallel, figuring out
interesting positions. Finally you use the `copy`, `skip` and `add` methods on
the `Transcriber` to either copy or replace parts of the source to your
destination.

In some use cases, the content we are trying to transcribe follows a specific
format (eg XML). It is usually preferable to use an appropriate library to
deserialize the content into a data structure, modify the data structure to
what we want and then use the library to serialize it back the desired format.
I agree, in most cases this _is_ preferable. The `Transcriber` can help a lot
when you want to preserve as much of the source content as possible.

## More examples

Here we capitalize the contents of a `<b>` tag in XML:

```python
def capitalize_b(source):
    transcriber = Transcriber(source)
    ptr = 0
    while True:
        try:
            # 'hello <b>john</b>, how was your day?'
            #        ^
            ptr = source.index('<b', ptr)
        except ValueError:
            break
        try:
            # 'hello <b>john</b>, how was your day?'
            #          ^
            ptr = source.index('>', ptr)
        except ValueError:
            break
        # 'hello <b>john</b>, how was your day?'
        #           ^
        start = ptr + 1
        try:
            # 'hello <b>john</b>, how was your day?'
            #               ^
            end = source.index('</b>', start)
        except ValueError:
            break
        transcriber.copy_until(start)
        transcriber.add(source[start:end].upper())
        transcriber.skip_until(end)
        # 'hello <b>john</b>, how was your day?'
        #                   ^
        ptr = end + 4
    transcriber.copy_until_end()
    return transcriber.get_destination()

capitalize_b('hello <b class="red">john</b>, how was your <b>day</b>?')
# <<< 'hello <b class="red">JOHN</b>, how was your <b>DAY</b>?'
```

Lets try another one:

```python
import ast


def get_pos(source, lineno, col_offset):
    """ Resolve the actual position based on line and column offset. """

    return (sum((len(line) + 1 for line in source.splitlines()[:lineno - 1])) +
            col_offset)


class MyVisitor(ast.NodeVisitor):
    def __init__(self, source):
        super().__init__()
        self.source = source
        self.transcriber = Transcriber(source)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id == "foo":
            start = get_pos(self.source,
                            node.func.lineno,
                            node.func.col_offset)
            end = get_pos(self.source,
                          node.func.end_lineno,
                          node.func.end_col_offset)
            self.transcriber.copy_until(start)
            self.transcriber.add("BAR")
            self.transcriber.skip_until(end)
        self.generic_visit(node)


def replace_foo_with_BAR(source):
    v = MyVisitor(source)
    v.visit(ast.parse(source))
    v.transcriber.copy_until_end()
    return v.transcriber.get_destination()


source = """
foo("Simple use-case")
foo = "When not used as a function call it should not be transformed"
func("neither when used as an argument", foo)
if some_condition:
    foo("Works in any place of the code")
foo("Also when", kwarg=foo("nested"))
"""

print(replace_foo_with_BAR(source))
# <<< BAR("Simple use-case")
# <<< foo = "When not used as a function call it should not be transformed"
# <<< func("neither when used as an argument", foo)
# <<< if some_condition:
# <<<     BAR("Works in any place of the code")
# <<< BAR("Also when", kwarg=BAR("nested"))
```
