---
layout: post
title:  "Solving Sudoku puzzles in style with Python"
date:   2020-09-25 20:00:00 +0300
categories: programming python
---

Ok, First things first: Writing a Sudoku solver is not a particularly
impressive feat. This post is about how to model this problem and how Python
can help with that. After we write the Soduku solver, we will demonstrate some
of the tricks we learned into other domains.

Lets start by talking a bit about slices.

## Slices

```python
s = slice(1, 2, 3)

s.start, s.stop, s.step
# >>> (1, 2, 3)
```

This doesn't look very impressive. `slice` is a Python built-in, yet it doesn't
seem to accomplish anything more than a `namedtuple` would. So, why does it
exist? To find out, lets try something:

```python
class Slicer:
    def __getitem__(self, index):
        return index

slicer = Slicer()
slicer[1]
# >>> 1
slicer[1:]
# >>> slice(1, None, None)
slicer[:2]
# >>> slice(None, 2, None)
slicer[1:2]
# >>> slice(1, 2, None)
slicer[1:2:3]
# >>> slice(1, 2, 3)
slicer[1::3]
# >>> slice(1, None, 3)
slicer[:2:3]
# >>> slice(None, 2, 3)
slicer[::3]
# >>> slice(None, None, 3)
slicer[:]
# >>> slice(None, None, None)
```

So, the square-bracket notation will invoke `__getitem__` but, before doing
that, it will convert the `a:b:c` notation into a `slice(a, b, c)` constructor.

Another related trick is that indexes, ie arguments to the square bracket
notation, can be pairs of things:

```python
slicer[1, 2]
# >>> (1, 2)
slicer[1, 2, 3]
# >>> (1, 2, 3)
slicer[1, 2:3]
# >>> (1, slice(2, 3, None))
```

This particular trick, however, is much less impressive since in Python it's
the comma (`,`) that makes a tuple and not the parentheses. This is why return
statements with more than one values work as they do:

```python
def foo():
    return 1, 2
foo()
# >>> (1, 2)
```

and why dangling commas can ruin your day:

```python
a = 1,
isinstance(a, int)
# >>> False
a
# >>> (1,)
```

Ok. Enough with slices and indexes. Back to Sudoku.

## Modeling a Sudoku puzzle

Lets get started. This is a class that represents a Sudoku puzzle:

```python
class Sudoku(list):
```

([Record scratch][xkcd]) Wait, a list? Shouldn't we represent a Sudoku puzzle
as a two-dimensional list?

Well, here's the issue: Sometimes it is better to treat a Sudoku puzzle as a
two-dimensional list, for example when you are verifying that no `3`s exist
in the same row, and sometimes as a one-dimensional list, for example when you
are iterating over every cell in the puzzle. So, which should it be?

My answer is (... drumroll ...) **both**, almost. We _store_ it as a
one-dimensional list, which is why we simply inherit from `list`. But, when we
_access_ it, we can do it either as a one-dimensional or a two-dimensional
list. Lets see how this works:

```python
class Sudoku(list):
    def __getitem__(self, index):
        try:
            x, y = index
        except Exception:
            return super().__getitem__(index)

        rows = [self[i:i + 9] for i in range(0, 9 * 9, 9)]  # 0, 9, 18, ...
        if isinstance(x, slice):
            return [row[y] for row in rows[x]]
        else:
            return rows[x][y]
```

So, if our index is a number or a slice, we will go to the
`super().__getitem__(index)` line and we will be treating the object like a
one-dimensional list:

```python
s = Sudoku(range(81))
s[3]
# >>> 3
s[3:9]
# >>> [3, 4, 5, 6, 7, 8]
```

_(Notice how we don't even have to write an `__init__` method. `list`'s
initialization works just fine)_

but if our index is a pair, the object will be split into rows and we will
access them as a two-dimensional list:

```python
# Get the 3rd cell of the 2nd row
s[1, 2]
# >>> 11
```

The best part is that we can use slices for any of the coordinates:

```python
# Get the 1st row
s[0, :]
# >>> [0, 1, 2, 3, 4, 5, 6, 7, 8]

# Get the 1st column
s[:, 0]
# >>> [0, 9, 18, 27, 36, 45, 54, 63, 72]

# Get part of the 4th row
s[3, 3:7]
# >>> [30, 31, 32, 33]

# Get the bottom-left 3x3 "box"
s[6:9, 0:3]
# >>> [[54, 55, 56],
# ...  [63, 64, 65],
# ...  [72, 73, 74]]
```

And we can pretty-print our puzzle without any extra code:

```python
s[:, :]
# >>> [[0,  1,  2,  3,  4,  5,  6,  7,  8 ],
# ...  [9,  10, 11, 12, 13, 14, 15, 16, 17],
# ...  [18, 19, 20, 21, 22, 23, 24, 25, 26],
# ...  [27, 28, 29, 30, 31, 32, 33, 34, 35],
# ...  [36, 37, 38, 39, 40, 41, 42, 43, 44],
# ...  [45, 46, 47, 48, 49, 50, 51, 52, 53],
# ...  [54, 55, 56, 57, 58, 59, 60, 61, 62],
# ...  [63, 64, 65, 66, 67, 68, 69, 70, 71],
# ...  [72, 73, 74, 75, 76, 77, 78, 79, 80]]
```

_(By the way, this way of accessing rows, columns and boxes should feel very
familiar to you if you've worked with NumPy)_

## Validation

```python
class Sudoku(list):
    # __getitem__

    def is_valid(self):
        """ Verifies that `self` follows the rules of a Sudoku puzzle. """

        # Make sure size is correct
        if not len(self) == 9 * 9:
            return False

        # Make sure all digits are between 0 and 9
        if set(self) > set(range(10)):
            return False

        # Rows
        if not all((self._check_unique(self[i, :]) for i in range(9))):
            return False

        # Columns
        if not all((self._check_unique(self[:, i]) for i in range(9))):
            return False

        # 3x3 boxes
        for row_start in range(0, 9, 3):  # 0, 3, 6
            for column_start in range(0, 9, 3):  # 0, 3, 6
                box = self[row_start:row_start + 3,
                           column_start:column_start + 3]
                flattened_box = [number for row in box for number in row]
                if not self._check_unique(flattened_box):
                    return False

        return True

    @staticmethod
    def _check_unique(numbers):
        """ Verifies that each number in `numbers` apart from `0` appears at
            most once.
        """

        numbers = [number for number in numbers if number != 0]
        return len(numbers) == len(set(numbers))
```

The "dual nature" of our Sudoku puzzle representation really shines here. We
can do things like `len(self)` and `set(self)` which treat `self` as a
one-dimensional list and we can resolve rows, columns and 3x3 boxes by treating
`self` as a two-dimensional list.

## Recursion

Now lets actually solve the puzzle. We won't do anything fancier that a simple
brute-force solution, ie try every possible value for all cells that have `0`
(ie are empty) until either the puzzle becomes invalid or full.

```python
class Sudoku(list):
    # __getitem__, is_valid, _check_unique

    def solve(self):
        """ Recursively solve the puzzle. If the current version is invalid or
            we can't solve any "descendant", return `None`. If there are no
            empty cells left, return `self`. If a descendant can get solved,
            return the solution.

            - A "descendant" is a slightly modified copy of `self` where the
              first empty cell is replaced with all numbers between 1 and 9
        """

        if not self.is_valid():
            return None

        if 0 not in self:
            # We ran out of empty cells, this is a complete, valid puzzle
            return self

        empty_pos = self.index(0)
        for candidate in range(1, 10):  # 1, 2, ... 9
            descendant = Sudoku(self[:empty_pos] +
                                [candidate] +
                                self[empty_pos + 1:])
            solved = descendant.solve()
            if solved is not None:
                return solved

        # We ran out of candidates, none worked
        return None
```

This method isn't the most sophisticated or impressive thing I've ever written.
What I want to draw attention to here is how being able to treat the puzzle as
a one-dimensional list makes things very easy and elegant while each statement
makes its purpose very clear:

- `pos = self.index(0)` to find the first empty cell
- `descendant = Sudoku(self[:pos] + [candidate] + self[pos + 1:])` to make a
  copy where the cell in position `pos` is replaced with `candidate`

## Demo time

You can copy paste the code and run it yourselves, but here it is in action:

```python
puzzle = Sudoku([0, 4, 0, 0, 0, 6, 0, 0, 0,
                 8, 0, 7, 0, 0, 3, 0, 4, 0,
                 0, 0, 0, 9, 0, 0, 1, 0, 0,
                 2, 0, 9, 0, 7, 0, 0, 0, 4,
                 6, 0, 0, 8, 0, 4, 0, 0, 2,
                 4, 0, 0, 0, 6, 0, 7, 0, 9,
                 0, 0, 1, 0, 0, 9, 0, 0, 0,
                 0, 6, 0, 2, 0, 0, 9, 0, 7,
                 0, 0, 0, 6, 0, 0, 0, 5, 0])
solved = puzzle.solve()  # 1.81 seconds
solved[:, :]
# >>> [[1, 4, 5, 7, 2, 6, 3, 9, 8],
# ...  [8, 9, 7, 5, 1, 3, 2, 4, 6],
# ...  [3, 2, 6, 9, 4, 8, 1, 7, 5],
# ...  [2, 1, 9, 3, 7, 5, 8, 6, 4],
# ...  [6, 7, 3, 8, 9, 4, 5, 1, 2],
# ...  [4, 5, 8, 1, 6, 2, 7, 3, 9],
# ...  [7, 8, 1, 4, 5, 9, 6, 2, 3],
# ...  [5, 6, 4, 2, 3, 1, 9, 8, 7],
# ...  [9, 3, 2, 6, 8, 7, 4, 5, 1]]
```

## Other uses of `__getitem__` and slices

This section is just for inspiration. Keep in mind that there is nothing we do
here that can't be done without using `__getitem__` and slices. My argument is
that the resulting code looks more natural while being very descriptive of its
purpose. We are essentially accessing "virtual lists" that generate their
contents the moment we ask for them.

### Fixtures for testing {json:api} responses

If you've worked with {json:api}, you know that the server responses look like
this:

```json
{"data": [{"type": "articles",
           "id": "1",
           "attributes": {"title": "Article 1", "created": "2020-09-01"},
           "relationships": {"author": {"data": {"type": "users", "id": 1},
                                        "links": {"related": "/users/1",
                                                  "self": "/articles/1/relationships/author"}}},
           "links": {"self": "/articles/1"}},
          {"type": "articles",
           "id": "2",
           "attributes": {"title": "Article 2", "created": "2020-09-02"},
           "relationships": {"author": {"data": {"type": "users", "id": 2},
                                        "links": {"related": "/users/2",
                                                  "self": "/articles/2/relationships/author"},
           "links": {"self": "/articles/1"}}}}],
 "included": [{"type": "users",
               "id": "1",
               "attributes": {"username": "user1", "full_name": "User 1"},
               "links": {"self": "/users/1"}},
              {"type": "users",
               "id": "2",
               "attributes": {"username": "user2", "full_name": "User 2"},
               "links": {"self": "/users/2"}}],
 "links": {"self": "/articles"}}
```

The advantages of an API having such detailed responses are many, but having to
write these by hand for unit-tests is very frustrating (I should know, I just
did it). Thankfully, writing a function that creates these is relatively easy.
Lets give it a shot:

```python
class JsonApiFixtures:
    def __init__(self, plural_type, singular_type=None, extra=None):
        if singular_type is None:
            singular_type = plural_type[:-1]  # items => item
        if extra is None:
            extra = {}

        self.plural_type = plural_type
        self.singular_type = singular_type
        self.extra = deepcopy(extra)

    def _get(self, i):
        result = {'type': self.plural_type,
                  'id': str(i),
                  'attributes': {'name': ("{} {}".
                                          format(self.singular_type, i))}}
        result.update(self.extra)
        return result

    def __getitem__(self, index):
        if isinstance(index, slice):
            start = index.start if index.start is not None else 1
            stop = index.stop
            step = index.step if index.step is not None else 1
            return [self._get(i) for i in range(start, stop, step)]
        else:
            return self._get(index)
```

```python
items = JsonApiFixtures('items')
items[1]
# >>> {'type': "items", 'id': "1", 'attributes': {'name': "item 1"}}
items[1:4]
# >>> [{'type': "items", 'id': "1", 'attributes': {'name': "item 1"}},
# ...  {'type': "items", 'id': "2", 'attributes': {'name': "item 2"}},
# ...  {'type': "items", 'id': "3", 'attributes': {'name': "item 3"}}]


articles = JsonApiFixtures(
    'articles',
    extra={'relationships': {
        'author': {'data': {'type': "users", 'id': "1"},
                   'links': {'self': "/articles/1/relationships/author",
                             'related': "/users/1"}},
    }}
)

articles[1:3]
# >>> [{'type': "articles",
# ...   'id': "1",
# ...   'attributes': {'name': "article 1"},
# ...   'relationships': {'author': {'data': {'type': "users", 'id': "1"},
# ...                                'links': {'self': "/articles/1/relationships/author",
# ...                                          'related': "/users/1"}}}},
# ...   {'type': "articles",
# ...    'id': "1",
# ...    'attributes': {'name': "article 1"},
# ...    'relationships': {'author': {'data': {'type': "users", 'id': "1"},
# ...                                 'links': {'self': "/articles/1/relationships/author",
# ...                                           'related': "/users/1"}}}}]

assert (test_client.get('/articles?filter[odd]=True').json()['data'] ==
        articles[1:11:2])
```

### Fixtures for testing Django ORM objects

Aka "poor man's [factory-boy][factory-boy]". This time we will dive straight
into the code:

```python
class DjangoOrmFixtures:
    def __init__(self, model, extra=None, **kwargs):
        self.model = model
        self.kwargs = kwargs

    def __call__(self, **kwargs):
        return self.__class__(self.model, **{**kwargs, **self.kwargs})

    def _get(self, i):
        result = {}
        for key, value in self.kwargs.items():
            try:
                value = value.format(i)
            except Exception:
                pass
            result[key] = value
        return self.model.objects.create(**result)

    def __getitem__(self, index):
        if isinstance(index, slice):
            start = index.start or 1
            stop = index.stop
            step = index.step or 1
            return [self._get(i) for i in range(start, stop, step)]
        else:
            return self._get(index)
```

```python
ArticleFixtures = DjangoOrmFixtures(Article,
                                    slug="article-{}",
                                    title="Article {}",
                                    content="Content of article {}")
UserFixtures = DjangoOrmFixtures(User,
                                 username="author-{}",
                                 first_name="Author{}",
                                 last_name="Authoropoulos{}")

author = UserFixtures[1]
articles = ArticleFixtures(author=author)[1:5]
```


[factory-boy]: https://factoryboy.readthedocs.io/en/latest/
[xkcd]: https://xkcd.com/1745/
