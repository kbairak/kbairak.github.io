---
layout: post
title:  "Messing around with the Python shell"
date:   2021-02-01 21:00:00 +0300
categories: programming python
---

## Intro

A lot of people hate bash scripting. Every time I have to do even the simplest
thing, I have to look up the documentation. How to I forward a function's
arguments to a child command? How do I assign a string to a variable and then
call that string as a command? How do I check if two string variables are
equal? How do I split a string into two and get the latter? etc

However, you can't deny the power of having entire programs act as mere
functions and how natural it is to pipe a program's output into another program.
So, I was wondering, can you combine some of bash's features with Python?

## The basics

Lets start with a class. It's a simple one that saves its initialization
arguments to a local variable, evaluates itself lazily with
[`subprocess.run`][subprocess_run] and saves its result.

```python
import subprocess

class PipePy:
    def __init__(self, *args):
        self._args = args
        self._result = None

    def _evaluate(self):
        if self._result is not None:
            return
        self._result = subprocess.run(self._args,
                                      capture_output=True,
                                      text=True)

    @property
    def returncode(self):
        self._evaluate()
        return self._result.returncode

    @property
    def stdout(self):
        self._evaluate()
        return self._result.stdout

    def __str__(self):
        return self.stdout

    @property
    def stderr(self):
        self._evaluate()
        return self._result.stderr
```

and lets take it out for a spin:

```python
ls = PipePy('ls')
ls_l = PipePy('ls', '-l')

print(ls)
# <<< files.txt
# ... main.py
# ... tags
print(ls_l)
# <<< total 16
# ... -rw-r--r-- 1 kbairak kbairak  125 Jan 22 08:53 files.txt
# ... -rw-r--r-- 1 kbairak kbairak 5425 Feb  1 21:54 main.py
# ... -rw-r--r-- 1 kbairak kbairak 1838 Feb  1 21:54 tags
```

## Making things seem more "command-like"

It won't do to have to have to invoke `PipePy` every time we want to customize
a command. It would be nice for

```python
ls_l = PipePy('ls', '-l')
print(ls_l)
```

to be equivalent to

```python
ls = PipePy('ls')
print(ls('-l'))
```

In other words, we want

```python
PipePy('ls', '-l')
```

to be equivalent to

```python
PipePy('ls')('-l')
```

Thankfully, the fact that our class creates lazy objects helps us a lot with
this:

```python
class PipePy:
    # __init__, etc

    def __call__(self, *args):
        args = self._args + args
        return self.__class__(*args)

ls = PipePy('ls')
print(ls('-l'))
# <<< total 16
# ... -rw-r--r-- 1 kbairak kbairak  125 Jan 22 08:53 files.txt
# ... -rw-r--r-- 1 kbairak kbairak 5425 Feb  1 21:54 main.py
# ... -rw-r--r-- 1 kbairak kbairak 1838 Feb  1 21:54 tags
```

## Keyword arguments

If we wanted to pass more arguments to `ls`, we might encounter `--sort=size`.
We can easily do `ls('-l', '--sort=size')`. Can we do better?

```diff
 class PipePy:
-    def __init__(self, *args):
+    def __init__(self, *args, **kwargs):
         self._args = args
+        self._kwargs = kwargs
         self._result = None

     def _evaluate(self):
         if self._result is not None:
             return
-        self._result = subprocess.run(self._args,
+        self._result = subprocess.run(self._convert_args(),
                                       capture_output=True,
                                       text=True)
 
+    def _convert_args(self):
+        args = list(self._args)
+        for key, value in self._kwargs.items():
+            key = key.replace('_', '-')
+            args.append(f"--{key}={value}")
+        return args
 
-    def __call__(self, *args):
+    def __call__(self, *args, **kwargs):
         args = self._args + args
+        kwargs = {**self._kwargs, **kwargs}
-        return self.__class__(*args)
+        return self.__class__(*args, **kwargs)

     # returncode, etc
```

Lets take this out for a spin:

```python
print(ls('-l'))
# <<< total 16
# ... -rw-r--r-- 1 kbairak kbairak  125 Jan 22 08:53 files.txt
# ... -rw-r--r-- 1 kbairak kbairak 5425 Feb  1 21:54 main.py
# ... -rw-r--r-- 1 kbairak kbairak 1838 Feb  1 21:54 tags


print(ls('-l', sort="size"))
# <<< total 16
# ... -rw-r--r-- 1 kbairak kbairak 5425 Feb  1 21:54 main.py
# ... -rw-r--r-- 1 kbairak kbairak 1838 Feb  1 21:54 tags
# ... -rw-r--r-- 1 kbairak kbairak  125 Jan 22 08:53 files.txt
```

## Piping

Things start to get interesting. Our final goal is to be able to do:

```python
ls = PipePy('ls')
grep = PipePy('grep')

print(ls | grep('tags'))
# <<< tags
```

Our process is:

1. Make our `__init__` and `__call__` methods accept a new `_pipe_input`
   keyword-only argument which we will save on `self`
2. During evaluation, if this `_pipe_input` is set, it will be passed to
   `subprocess.run` as the `input` argument.
3. Override the `__or__` method to pass the outcome of the left operand as the
   pipe input to the right operand

```diff
 class PipePy:
-    def __init__(self, *args, **kwargs):
+    def __init__(self, *args, _pipe_input=None, **kwargs):
         self._args = args
         self._kwargs = kwargs
+        self._pipe_input = _pipe_input
         self._result = None
 
-    def __call__(self, *args, **kwargs):
+    def __call__(self, *args, _pipe_input=None, **kwargs):
         args = self._args + args
         kwargs = {**self._kwargs, **kwargs}
-        return self.__class__(*args, **kwargs)
+        return self.__class__(*args, _pipe_input=_pipe_input, **kwargs)
 
     def _evaluate(self):
         if self._result is not None:
             return
         self._result = subprocess.run(self._convert_args(),
+                                      input=self._pipe_input,
                                       capture_output=True,
                                       text=True)
 
+    def __or__(left, right):
+        return right(_pipe_input=left.stdout)
```

Lets try this out (slightly modifying the command from before to prove this
actually works):

```python
ls = PipePy('ls')
grep = PipePy('grep')

print(ls('-l') | grep('tags'))
# <<< -rw-r--r-- 1 kbairak kbairak 1838 Feb  1 21:54 tags
```

## Lets add a few easy goodies

1. Truthiness:

   ```python
   class PipePy:
       # __init__, etc

       def __bool__(self):
           return self.returncode == 0
   ```

   Now we can do:

   ```python
   git = PipePy('git')
   grep = PipePy('grep')

   if git('branch') | grep('my_feature'):
       print("Branch 'my_feature' found")
   ```

2. Read from/write to files:

   ```python
   class PipePy:
       # __init__, etc

       def __gt__(self, filename):
           with open(filename, 'w') as f:
               f.write(self.stdout)

       def __rshift__(self, filename):
           with open(filename, 'a') as f:
               f.write(self.stdout)

       def __lt__(self, filename):
           with open(filename) as f:
               return self(_pipe_input=f.read())
   ```

   Now we can do:

   ```python
   ls = PipePy('ls')
   grep = PipePy('grep')
   cat = PipePy('cat')

   ls > 'files.txt'

   print(grep('main') < 'files.txt')
   # <<< main.py

   ls >> 'files.txt'
   print(cat('files.txt'))
   # <<< files.txt
   # ... main.py
   # ... tags
   # ... files.txt
   # ... main.py
   # ... tags

   ```

3. Iterations:

   ```python
   class PipePy:
       # __init__, etc

       def __iter__(self):
           return iter(self.stdout.split())
   ```

   Now we can do:

   ```python
   ls = PipePy('ls')

   for name in ls:
       print(name.upper())
   # <<< FILES.TXT
   # ... MAIN.PY
   # ... TAGS
   ```

4. Tables:

   ```python
   class PipePy:
       # __init__, etc

       def as_table(self):
           lines = self.stdout.splitlines()
           fields = lines[0].split()
           result = []
           for line in lines[1:]:
               item = {}
               for i, value in enumerate(line.split(maxsplit=len(fields) - 1)):
                   item[fields[i]] = value
               result.append(item)
           return result
   ```

   Now we can do:

   ```python
   ps = PipePy('ps')
   print(ps)
   # <<<     PID TTY          TIME CMD
   # ...    4205 pts/4    00:00:00 zsh
   # ...   13592 pts/4    00:00:22 ptipython
   # ...   16253 pts/4    00:00:00 ps
   ps.as_table()
   # <<< [{'PID': '4205', 'TTY': 'pts/4', 'TIME': '00:00:00', 'CMD': 'zsh'},
   # ...  {'PID': '13592', 'TTY': 'pts/4', 'TIME': '00:00:22', 'CMD': 'ptipython'},
   # ...  {'PID': '16208', 'TTY': 'pts/4', 'TIME': '00:00:00', 'CMD': 'ps'}]
   ```

## Things start to get dangerous (or making things seem more shell-like)

This whole `print(ls)` business is getting annoying. If I am in an interactive
shell, I want to be able to to simply type `ls` and be done with it. Well...

```python
class PipePy:
    # __init__, etc

    def __repr__(self):
        return self.stdout + self.stderr
```

(Interactive shell)

```
>>> ls = PipePy('ls')
>>> ls
files.txt
main.py
tags
```

Ok, but as the title suggests, things have started to get dangerous. Our
instances are lazy, meaning that they will be evaluated if and when we are
interested in their result, and not again after that. What if we simply want to
make sure that the action is performed? For example, suppose we have this
script:

```python
from pipepy import PipePy
tar = PipePy('tar')
tar('-xf', 'some_archive')
print("File extracted")
```

This script will not actually do anything because the `tar` call is not
actually evaluated. I think a nice convention would be to make `__call__` force
an evaluation if invoked without arguments:

```diff
 class PipePy:
     def __call__(self, *args, _pipe_input=None, **kwargs):
         args = self._args + args
         kwargs = {**self._kwargs, **kwargs}
-        return self.__class__(*args, _pipe_input=_pipe_input, **kwargs)
+        result = self.__class__(*args, _pipe_input=_pipe_input, **kwargs)
+        if not args and not _pipe_input and not kwargs:
+            result._evaluate()
+        return result
```

So, when we are scripting, if we want to ensure that a command is actually
invoked, we **have to** invoke it with a pair of parentheses.

But, we are not out of the woods yet. Consider this:

```python
date = PipePy('date')
date
# <<< Mon Feb  1 10:43:08 PM EET 2021

# Wait 5 seconds

date
# <<< Mon Feb  1 10:43:08 PM EET 2021
```

Oh no! The date hasn't changed. It makes sense. The `date` object keeps its
`_result` in memory. Subsequent evaluations won't actually invoke the command,
but simply return the stored value.

One solution would be to force a creation of a copy by invoking with empty
parentheses:

```python
date = PipePy('date')
date()
# <<< Mon Feb  1 10:45:09 PM EET 2021

# Wait 5 seconds

date()
# <<< Mon Feb  1 10:45:14 PM EET 2021
```

Another solution is this: instances returned by the `PipePy` constructor will
not supposed to be lazy, but instances returned by a `__call__` invocation will
be.

```diff
 class PipePy:
-    def __init__(self, *args, _pipe_input=None, **kwargs):
+    def __init__(self, *args, _pipe_input=None, _lazy=False, **kwargs):
         self._args = args
         self._kwargs = kwargs
         self._pipe_input = _pipe_input
+        self._lazy = _lazy
         self._result = None
 
     def __call__(self, *args, _pipe_input=None, **kwargs):
         args = self._args + args
         kwargs = {**self._kwargs, **kwargs}
-        result = self.__class__(*args, _pipe_input=_pipe_input, **kwargs)
+        result = self.__class__(*args,
+                                _pipe_input=_pipe_input,
+                                _lazy=True,
+                                **kwargs)
         if not args and not _pipe_input and not kwargs:
             result._evaluate()
         return result
 
     def _evaluate(self):
-        if self._result is not None:
+        if self._result is not None and self._lazy:
             return
         self._result = subprocess.run(self._convert_args(),
                                       input=self._pipe_input,
                                       capture_output=True,
                                       text=True)
```

Taking it out for a spin:

```python
date = PipePy('date')
date
# <<< Mon Feb  1 10:54:09 PM EET 2021

# Wait 5 seconds

date
# <<< Mon Feb  1 10:54:14 PM EET 2021
```

and predictably, using the return value of an empty invocation will have the
previous behavior:

```python
date = PipePy('date')
d = date()
d
# <<< Mon Feb  1 10:56:21 PM EET 2021

# Wait 5 seconds

d
# <<< Mon Feb  1 10:56:21 PM EET 2021
```

but that's ok. You wouldn't expect `d` to update its value.

## Dangerouser and dangerouser

Ok, `ls('-l')` is not bad, but it would be nice if we could simply do `ls -l`
like human beings. Hmm, I have an idea:

```python
class PipePy:
    # __init__, etc

    def __sub__(left, right):
        return left(f"-{right}")
```

So, now we can do:

```python
ls = PipePy('ls')
ls - 'l'
# <<< total 16
# ... -rw-r--r-- 1 kbairak kbairak   46 Feb  1 23:04 files.txt
# ... -rw-r--r-- 1 kbairak kbairak 5425 Feb  1 21:54 main.py
# ... -rw-r--r-- 1 kbairak kbairak 1838 Feb  1 21:54 tags
```

And we are one step away from:

```python
l = 'l'
ls -l
```

and now I just can't help myself:

```python
import string
for char in string.ascii_letters:
    if char in locals():
        continue
    locals()[char] = char

class PipePy:
    # __init__, etc
```

## More dangerousness!!!

Playing with `locals()` gave me an idea (ominous music). Why should we have to
instantiate `PipePy` all the time? Can't we _find_ all executables in our path
and create PipePy instances out of them? Silly question, of course we can!

```python
import os
import stat

for path in os.get_exec_path():
    try:
        names = os.listdir(path)
    except FileNotFoundError:
        continue
    for name in names:
        if name in locals():
            continue
        if 'x' in stat.filemode(os.lstat(os.path.join(path, name)).st_mode):
            locals()[name] = PipePy(name)
```

So now, put everything we have in a python file and script away (this is a
transcription of an actual bash script):

```python
from pipepy import mysqladmin, sleep, drush, grep

for i in range(10):
    if mysqladmin('ping',
                  host="mysql_drupal7",
                  user="user",
                  password="password"):
        break
    sleep(1)()  # Remember to actually invoke

if not drush('status', 'bootstrap') | grep('-q', 'Successful'):
    drush('-y', 'site-install', 'standard',
          db_url="mysql://user:password@mysql_drupal7:3306/drupal",
          acount_pass="kbairak")()  # Remember to actually invoke

drush('en', 'tmgmt_ui', 'tmgmt_entity_ui', 'tmgmt_node_ui')()
```

## Conclusion

Well, I had a lot of fun with this. To be honest, I am probably too scared to
actually use it, but who knows?

[subprocess_run]: https://docs.python.org/3/library/subprocess.html#subprocess.run
