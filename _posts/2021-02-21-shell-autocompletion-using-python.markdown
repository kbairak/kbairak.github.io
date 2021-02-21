---
layout: post
title:  "Shell auto-completion using python"
date:   2021-02-21 21:00:00 +0300
categories: programming python
---

My [latest blog post][latest-blog-post] acted as inspiration for my most
ambitious open-source library yet: [PipePy][pipepy]. Part of this library is
`pymake`, a command line program that aims to replace GNU make, but with the
makefiles written in Python. As I was polishing the whole thing, I started
wondering if there was a way to add shell autocompletion for it, with the shell
offering different options based on the current makefile's targets.

For both `bash` and `zsh` there are multiple ways to go about this. I will only
list those that I ended up using myself and that allow using python for
generating the completions.

## bash

### One way shell completion works in bash

In bash, at some point you can run `complete -C command_A command_B`. This
tells bash the following:

> When the user wants to get auto-complete suggestions for **command_B**, run
> `command_A command_B <last_word> <second_to_last_word>` and use each line of
> its output as completion suggestions

So, for example, lets assume the user types:

```sh
→ complete -C command_A command_B
→ command_B hello abc<Tab>
```

bash will run:

```sh
→ command_A command_B abc hello
```

If `command_A` returns:

```
abcdef
```

then bash will complete the missing 'def' to the shell

If `command_A` returns:

```
abcdef
abc123
```

then bash will offer both completions as suggestions.

### Do it with Python

So, we need a way for the user to set up auto-completion without having to know
the intricacies of how it works. For setting things up, we can create a command
that outputs something like `complete -C command_A command_B` that they can
wrap with `eval $(...)`. Then we need to provide a command to play the role of
`command_A` from our example.

Fortunately, we don't have to pollute the user's path with lots of executables;
if they have `pymake` installed, then they can simply run `eval $(pymake
--setup-bash-completion)`, which will run `complete -C 'pymake --complete-bash'
pymake`. Then, as promised, `pymake --complete-bash` will generate completion
options for `pymake`:

```
# setup.cfg
[options.entry_points]
console_scripts =
    pymake = pipepy.pymake:pymake
```

```python
# pipepy/pymake.py
def pymake():
    if _pymake_complete(*sys.argv[1:]):
        return
    # Run actual pymake code
    ...

def _pymake_complete(*args):
    if args and args[0] == "--setup-bash-completion":
        print("complete -C 'pymake --complete-bash' pymake")
    elif args and args[0] == "--complete-bash":
        # TODO
        print("option 1")
        print("option 2")
        print("option 3")
    # More `elif`s ...
    else:
        return False
    return True
```

Here is the output of `pymake --setup-bash-completion`

```sh
→ pymake --setup-bash-completion
complete -C 'pymake --complete-bash' pymake
```

Now we need to fill the body of the `elif` part with actual suggestions for
`pymake`. The suggestions we want are the names of the make targets, which
means that we want all top-level functions defined in the `Makefile.py` module
in the current directory:

```python
# pipepy/pymake.py
Makefile = None

def _pymake_complete(*args):
    if args and args[0] == "--setup-bash-completion":
        print("complete -C 'pymake --complete-bash' pymake")
    elif args and args[0] == "--complete-bash":
        # imports the local Makefile.py file and assigns it to the global
        # `Makefile` variable
        _load_makefile()
        word = args[-2]  # This is where bash will put the word being completed
        result = []
        for attr in dir(Makefile):
            if not attr.startswith(word):
                continue
            func = getattr(Makefile, attr):
            if (not callable(func) or
                    getattr(func, '__module__', '') != "Makefile"):
                # Only functions and only if they were defined in Makefile.py,
                # not imported from somewhere else
                continue
            result.append(attr)
        print("\n".join(result))
    # More `elif`s ...
    else:
        return False
    return True
```

Here is how the result looks:

```
[kbairak@kbairakdelllaptop pipepy]$ pymake <TAB><TAB>
build      clean      debugtest  publish    watchtest
checks     covtest    html       test
```

## zsh

### One way shell completion works in zsh

Similarly to bash, you can type the following in zsh: `compdef func command`.
The catch here is that `func` has to be a zsh function and instead of using its
output for the suggestions, `func` has to call some zsh-specific builtins that
instruct zsh on how to perform completion. This is better explained with an
example:

```sh
→ _pymake() {
    local -a subcmds
    subcmds = (
      'water:water the plants'
      'pet:pet the dog'
    )
    _describe 'command' subcmds
  }
→ compdef _pymake pymake
```

The nice thing that zsh offers is that, apart from offering completions, it can
offer descriptions of each option. So if, after the previous snippet, you type
`pymake <TAB>`, you will see something like this:

```sh
→ pymake <TAB>
water  -- water the plants
pet    -- pet the dog
```

### Do it with Python

The problem with how zsh does things is that the `_pymake` function from the
previous example must be written in zsh code and not in Python. We can, and
will, get around this with `eval` again. Our goal is to be able to again offer
the user the option of running `eval $(pymake --setup-zsh-completion)` and have
everything taken care of.

Here is our python code for making this possible:

```python
def _pymake_complete(*args):
    if args and args[0] == "--setup-bash-completion":
        ...
    elif args and args[0] == "--complete-bash":
        ...
    elif args and args[0] == "--setup-zsh-completion":
        print("_pymake() { eval $(pymake --complete-zsh) }; "
              "compdef _pymake pymake")
    elif args and args[0] == "--complete-zsh":
        result = """
            local -a subcmds;
            subcmds=(
                'water:water the plants'
                'pet:pet the dog'
            );
            _describe 'command' subcmds
        """
        print(" ".join((line.strip() for line in result.splitlines())))
    else:
        return False
    return True
```

Here is the output of `pymake --setup-zsh-completion`

```sh
→ pymake --setup-zsh-completion
_pymake() { eval $(pymake --complete-zsh) }; compdef _pymake pymake
 ```

Now its time to fill in the code that generates the actual suggestions. Since
zsh gives us the option of providing the descriptions of the suggestions, we
are going to use the functions' docstrings, if available:

```python
def _pymake_complete(*args):
    if args and args[0] == "--setup-bash-completion":
        ...
    elif args and args[0] == "--complete-bash":
        ...
    elif args and args[0] == "--setup-zsh-completion":
        ...
    elif args and args[0] == "--complete-zsh":
        _load_makefile()
        result = """
            local -a subcmds;
            subcmds=(
        """
        for attr in dir(Makefile):
            func = getattr(Makefile, attr)
            if (not callable(func) or
                    getattr(func, '__module__', '') != "Makefile"):
                continue
            if func.__doc__:
                doc = func.__doc__
                # Perform escaping
                doc = doc.\
                    replace("'", "\\'").\
                    replace(':', '\\:').\
                    replace('\\', '\\\\')
                doc = " ".join([line.strip()
                                for line in doc.splitlines()
                                if line.strip()])
                result += f" '{attr}:{doc}'"
            else:
                result += f" '{attr}'"
        result += """
            );
            _describe 'command' subcmds
        """
        print(" ".join((line.strip() for line in result.splitlines())))
    else:
        return False
    return True
```

And here is the output of `pymake --complete-zsh` (adding some newlines to make
this more readable):

```
→ pymake --complete-zsh
local -a subcmds;
subcmds=(
    'build:Build package'
    'checks:Run static checks on the code (flake8, isort)'
    'clean:Clean up build directories'
    'covtest:Run tests and produce coverge report'
    'debugtest:Run tests without capturing their output. This makes using an interactive debugger possible'
    'html:Run tests and open coverage report in browser'
    'publish:Publish pacage to PyPI'
    'test:Run tests'
    'watchtest:Automatically run tests when a source file changes'
);
_describe 'command' subcmds
```

_(A reminder here that this output will be different depending on which folder
we are running it from and the contents of the local `Makefile.py` file)_

So, after all this, we can get the following lovely auto-completion from
pymake (if run at the same folder as PipePy's source code):

```
→ pymake <TAB>
build      -- Build package
checks     -- Run static checks on the code (flake8, isort)
clean      -- Clean up build directories
covtest    -- Run tests and produce coverge report
debugtest  -- Run tests without capturing their output. This makes using an interactive debugger possible
html       -- Run tests and open coverage report in browser
publish    -- Publish pacage to PyPI
test       -- Run tests
watchtest  -- Automatically run tests when a source file changes
```

## Conclusion

Python works a lot better than bash or zsh scripts when you have to tackle
complex logic (this is the main reason behind the development of the PipePy
library in general), so it's nice that we have an option to write the
auto-completion in Python. Plus, in this example, it was a requirement, since
in order to be able to provide suggestions, we **have** to import the
`Makefile.py` module first.

The nice thing is that, despite all the underlying complexity, the only thing
the user has to be instructed to do, is to run
`eval $(pymake --setup-bash-completion)` or
`eval $(pymake --setup-zsh-completion)` or put it at the end of their `.bashrc`
or `.zshrc` and they're good to go!


[latest-blog-post]: {% post_url 2021-02-01-messing-with-the-python-shell %}
[pipepy]: https://github.com/kbairak/pipepy
