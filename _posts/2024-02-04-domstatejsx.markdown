---
layout: post
title:  "Introducing domstatejsx"
date:   2024-02-04 19:00:00 +0300

categories: programming react
---

## Introduction

This week I created a new web frontend framework. I know, there are already a
lot of great ones to choose from and it's highly unlikely that mine will find a
place among them, but I couldn't help myself once I had the initial idea.

It all started when I read
[this article](https://dev.to/paulgordon/after-using-rawjs-im-never-touching-react-again-or-any-framework-vanilla-javascript-is-the-future-3ac1)
in dev.to. Here, the author is presenting his library called
[rawjs](https://github.com/squaresapp/rawjs) and is claiming that his approach
is a valid alternative to popular frameworks like React, Vue, Angular etc.
`rawjs` is simply a wrapper around the native `document.createElement` function
and makes creating DOM elements easier. His main proposal is that the state of
a frontend application should not be in some "pure" form stored in state
variables that the framework monitors for changes and then re-renders the
application. Instead, the state could live in the DOM.

This is an interesting idea, so I played around with it. In my mind, this is a
tradeoff not dissimilar to the one you get with database tables and indexes:

- Without an index, _writes_ to the database are quick because you are simply
  making the changes you want and you're done. Reads, however, are slow.

- With an index, _reads_ are fast(er) but _writes_ are slow(er) because after
  each change, you have to update the index.

With frontend frameworks, the tradeoff looks like this:

- With a reactive framework, changes to the state are expensive because after
  each change, the framework has to re-render the (virtual) DOM, doing
  everything in its power to make this a fast process. Reading from the state,
  however, is fast. If you want to display an aggregation or prepare a payload
  for an AJAX request, you already have the state available in a "pure" format.

- By keeping your state in the DOM, changes to your state are instantaneous, you
  simply change the DOM at the relevant place. If we are talking about a
  checkbox or other input element, you don't have to do anything, the browser
  takes care of "maintaining your state" for you. If you want to _read_ your
  state, however, you have to inspect the DOM itself to retrieve it.

I don't claim that this new approach is better than the reactive one, but I
can't deny it's interesting. Interesting enough that I wanted to create a
framework around it and try building some demo applications to try to push it to
its limits.

My first experiments were with `rawjs`, but I quickly found myself wanting to
use JSX for building DOM elements and render components. This is somewhat easy
to accomplish. All I have to do is to write the `createElement` and `jsx`
functions in my library and put this in my vite config file:

```javascript
// vite.config.js
export default {
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '/src/lib/domstatejsx',
  },
};
```

`domstatejsx` is my running name for my library. The heavy-lifting of
converting JSX to DOM elements is done by the
[jsx-dom](https://github.com/alex-kinokon/jsx-dom) library. My library wraps
around it to provide some extra functionality and provides several utilities
and hooks.

With all this in place, I can do this in my main file:

```javascript
// src/main.jsx
document.body.append(<h1>hello world</h1>);
```

Ok. So let's try doing something interesting:

```javascript
// src/main.jsx
import App from './todos';
document.body.append(<App />);

// src/todos.jsx
export default function App() {
  function handleAdd(event) {
    event.preventDefault();
  }

  return (
    <>
      <h1>My TODO application</h1>
      <form onSubmit={handleAdd}>
        <input autofocus />
        <button>Add</button>
      </form>
      <ul />
    </>
  );
}
```

## Refs

Before we implement the submit handler, we need a way to keep references to the
DOM elements we create. For this we will introduce refs (you will notice that I
borrow as much as possible from React's terminology).

```diff
 export default function App() {
+  const newTodoInput = {};
+  const todoList = {};

   function handleAdd(event) {
     event.preventDefault();
   }
 
   return (
     <>
       <h1>My TODO application</h1>
       <form onSubmit={handleAdd}>
-        <input autofocus />
+        <input autofocus ref={newTodoInput} />
         <button>Add</button>
       </form>
-      <ul />
+      <ul ref={todoList} />
     </>
   );
 }
```

Just like with React, when our JSX parser creates a DOM element, it will assign
it to the ref's `current` attribute. Because our component functions will only
run once (for each component), we don't have to use a fancy `useRef` hook to
ensure we get the same reference across different re-renders; a simple object
will do for us. However, because we will end up needing a lot of refs, there is
a helper function that allows us to do this:

```diff
+import { useRefs } from './lib/domstatejsx';

 export default function App() {
-  const newTodoInput = {};
-  const todoList = {};
+  const [newTodoInput, todoList] = useRefs();

   function handleAdd(event) {
     event.preventDefault();
   }
 
   return (
     // ...
   );
 }
```

`useRefs` simply returns an endless list of new empty objects. In fact, here is
its implementation:

```javascript
export function* useRefs() {
  for (; ;) yield {};
}
```

So now we can move ahead and implement our submit handler that adds new TODOs
to our list.

```diff
 import { useRefs } from './lib/domstatejsx';

 export default function App() {
   const [newTodoInput, todoList] = useRefs();

   function handleAdd(event) {
     event.preventDefault();
+    if (!newTodoInput.current.value) return;
+    todoList.current.append(<li>{newTodoInput.current.value}</li>);
+    newTodoInput.current.value = '';
   }
 
   return (
     // ...
   );
 }
```

## Hooks

Now is a good time to introduce another class of utility functions. Since we
appear to be modifying DOM elements via their refs and since these
modifications will start following some patterns, we can do this:

```diff
-import { useRefs } from './lib/domstatejsx';
+import { useRefs, useTextInput } from './lib/domstatejsx';

 export default function App() {
   const [newTodoInput, todoList] = useRefs();
+  const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);

   function handleAdd(event) {
     event.preventDefault();
-    if (!newTodoInput.current.value) return;
+    if (!getNewTodoInputValue()) return;
-    todoList.current.append(<li>{newTodoInput.current.value}</li>);
+    todoList.current.append(<li>{getNewTodoInputValue()}</li>);
-    newTodoInput.current.value = '';
+    setNewTodoInputValue('');
   }
 
   return (
     // ...
   );
 }
```

These "hooks" will become more and more frequent as we move along since we will
have to modify the DOM a lot. It's very easy to imagine how they work, in fact
the one we used may be the simplest of them all:

```javascript
export function useTextInput(ref) {
  function get() { return ref.current.value; }
  function set(value) { ref.current.value = value; }
  return [get, set];
}
```

Now, let's add a summary section:

```diff
-import { useRefs, useTextInput } from './lib/domstatejsx';
+import { useRefs, useTextInput, useIntContent } from './lib/domstatejsx';

 export default function App() {
-  const [newTodoInput, todoList] = useRefs();
+  const [totalSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
+  const [, setTotal] = useIntContent(totalSpan);

   function handleAdd(event) {
     event.preventDefault();
     if (!getNewTodoInputValue()) return;
     todoList.current.append(<li>{getNewTodoInputValue()}</li>);
     setNewTodoInputValue('');
+    setTotal((prev) => prev + 1);
   }
 
   return (
     <>
       <h1>My TODO application</h1>
+      <h2>
+        Summary
+        <small>Total: <span ref={totalSpan}>0</span></small>
+      </h2>
       <form onSubmit={handleAdd}>
         <input autofocus ref={newTodoInput} />
         <button>Add</button>
       </form>
       <ul ref={todoList} />
     </>
   );
 }
```

`useIntContent` works like `useTextInput` with the following differences:

1. It reads and modifies the content of a DOM element (instead of its `value`
   property)
2. It returns and accepts integer values
3. The setter can accept a function in order to perform incremental changes
   (which is why we don't need to use the getter)

So now, when we add a new TODO, we increment the total count by one.

## Components

Let's turn the TODOs into components so that we can add functionality to them:

```diff
 import { useRefs, useTextInput, useIntContent } from './lib/domstatejsx';

 export default function App() {
   const [totalSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
   const [, setTotal] = useIntContent(totalSpan);

   function handleAdd(event) {
     event.preventDefault();
     if (!getNewTodoInputValue()) return;
-    todoList.current.append(<li>{getNewTodoInputValue()}</li>);
+    todoList.current.append(<Todo text={getNewTodoInputValue()} />);
     setNewTodoInputValue('');
     setTotal((prev) => prev + 1);
   }
 
   return (
     // ...
   );
 }
 
+function Todo({ text }) {
+  return (
+    <li>
+      {text}
+    </li>
+  );
+}
```

And let's add a button to delete a TODO:

```diff
 import { useRefs, useTextInput, useIntContent } from './lib/domstatejsx';

 export default function App() {
   // ...
 }

 function Todo({ text }) {
+  const [head] = useRefs();
 
+  function handleDelete() {
+    head.current.remove();
+  }
   return (
-    <li>
+    <li ref={head}>
+      <button onClick={handleDelete}>❌</button>
       {text}
     </li>
   );
 }
```

The good news is that, since our state lives in the DOM, removing the `<li>` is
all it takes. The bad news is that our total we keep track of in the summary
will be wrong. Let's fix this.

```diff
 import { useRefs, useTextInput, useIntContent } from './lib/domstatejsx';

 export default function App() {
   const [totalSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
   const [, setTotal] = useIntContent(totalSpan);
 
+  function onDelete() {
+    setTotal((prev) => prev - 1);
+  }

   function handleAdd(event) {
     event.preventDefault();
     if (!getNewTodoInputValue()) return;
-    todoList.current.append(<Todo text={getNewTodoInputValue()} />);
+    todoList.current.append(<Todo text={getNewTodoInputValue()} onDelete={onDelete} />);
     setNewTodoInputValue('');
     setTotal((prev) => prev + 1);
   }
 
   return (
     // ...
   );
 }
 
-function Todo({ text }) {
+function Todo({ text, onDelete }) {
   const [head] = useRefs();

   function handleDelete() {
+    onDelete();
     head.current.remove();
   }
   return (
     <li ref={head}>
       <button onClick={handleDelete}>❌</button>
       {text}
     </li>
   );
 }
```

## Context

Before we move on, it's a good opportunity to introduce something new: contexts.
Since we borrow a lot from React's design, a lot of this is going to look
familiar:

```diff
-import { useRefs, useTextInput, useIntContent } from './lib/domstatejsx';
+import {
+  useRefs, useTextInput, useIntContent, createContext, useContext
+} from './lib/domstatejsx';

 export default function App() {
   const [totalSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
   const [, setTotal] = useIntContent(totalSpan);

   function onDelete() {
     setTotal((prev) => prev - 1);
   }

   function handleAdd(event) {
     event.preventDefault();
     if (!getNewTodoInputValue()) return;
-    todoList.current.append(<Todo text={getNewTodoInputValue()} onDelete={onDelete} />);
+    todoList.current.append(<Todo text={getNewTodoInputValue()} />);
     setNewTodoInputValue('');
     setTotal((prev) => prev + 1);
   }
 
   return (
     <>
       <h1>My TODO application</h1>
       <h2>
         Summary
         <small>Total: <span ref={totalSpan}>0</span></small>
       </h2>
       <form onSubmit={handleAdd}>
         <input autofocus ref={newTodoInput} />
         <button>Add</button>
       </form>
+      <App.Context.Provider value={% raw %}{{ onDelete }}{% endraw %}>
         <ul ref={todoList} />
+      </App.Context.Provider>
     </>
   );
 }
+App.Context = createContext();
 
-function Todo({ text, onDelete }) {
+function Todo({ text }) {
   const [head] = useRefs();

   function handleDelete() {
+    const { onDelete } = useContext(head.current, App.Context);
     onDelete();
     head.current.remove();
   }
   return (
     <li ref={head}>
       <button onClick={handleDelete}>❌</button>
       {text}
     </li>
   );
 }
```

If you are familiar with React's context, you should feel mostly at home. The
differences are:

1. We attached the context to the `App` function. We didn't _have_ to do this,
   but because we will be working with contexts a lot, it may make sense in the
   future to import a reusable component from a file and have an easy way to
   import its context along with it.

2. We provide a DOM element as the first argument to `useContext`. Since our
   state lives in the DOM, our context does as well. If you inspect the DOM
   while the application is running, you will notice a `data-` property in the
   `ul` element that facilitates attaching the context's value to the DOM. So,
   in order for `useContext` to find the context, it will need a DOM element to
   start its search from.

3. We don't invoke `useContext` in the main body of the `Todo` component but in
   an event handler. Again, since the context lives in the DOM, we need to be
   sure that our component is mounted before we invoke `useContext`. This only
   happens after the `Todo` function has returned.

Lets move ahead and add a way to mark a TODO as "done":

```diff
 import {
   useRefs, useTextInput, useIntContent, createContext, useContext
 } from './lib/domstatejsx';

 export default function App() {
-  const [totalSpan, newTodoInput, todoList] = useRefs();
+  const [totalSpan, doneSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
   const [, setTotal] = useIntContent(totalSpan);
+  const [, setDone] = useIntContent(doneSpan);

   function onDelete() {
     setTotal((prev) => prev - 1);
   }
 
+  function onDone(done) {
+    setDone((prev) => prev + (done ? 1 : -1));
+  }

   function handleAdd(event) {
     // ...
   }
 
   return (
     <>
       <h1>My TODO application</h1>
       <h2>
         Summary
-        <small>Total: <span ref={totalSpan}>0</span></small>
+        <small>
+          Total: <span ref={totalSpan}>0</span>,
+          done: <span ref={doneSpan}>0</span>
+        </small>
       </h2>
       <form onSubmit={handleAdd}>
         <input autofocus ref={newTodoInput} />
         <button>Add</button>
       </form>
-      <App.Context.Provider value={% raw %}{{ onDelete }}{% endraw %}>
+      <App.Context.Provider value={% raw %}{{ onDelete, onDone }}{% endraw %}>
         <ul ref={todoList} />
       </App.Context.Provider>
     </>
   );
 }
 App.Context = createContext();

 function Todo({ text }) {
   const [head] = useRefs();

   function handleDelete() {
     const { onDelete } = useContext(head.current, App.Context);
     onDelete();
     head.current.remove();
   }
 
+  function handleDone(event) {
+    const { onDone } = useContext(head.current, App.Context);
+    onDone(event.target.checked);
+  }

   return (
     <li ref={head}>
+      <input type="checkbox" onChange={handleDone} />
       <button onClick={handleDelete}>❌</button>
       {text}
     </li>
   );
 }
```

One more thing: if we delete a TODO that is "done", we don't have to only
decrement the 'total' counter but the 'done' counter as well.

```diff
 import {
-  useRefs, useTextInput, useIntContent, createContext, useContext
+  useRefs, useTextInput, useIntContent, createContext, useContext, useCheckbox
 } from './lib/domstatejsx';

 export default function App() {
   const [totalSpan, doneSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
   const [, setTotal] = useIntContent(totalSpan);
   const [, setDone] = useIntContent(doneSpan);
 
-  function onDelete() {
+  function onDelete(wasDone) {
     setTotal((prev) => prev - 1);
+    setDone((prev) => prev - Number(wasDone));  // Number(true) == 1, Number(false) == 0
   }

   function onDone(done) {
     setDone((prev) => prev + (done ? 1 : -1));
   }

   function handleAdd(event) {
     // ...
   }
 
   return (
     // ...
   );
 }
 App.Context = createContext();

 function Todo({ text }) {
-  const [head] = useRefs();
+  const [head, doneCheckbox] = useRefs();
+  const [isDone] = useCheckbox(doneCheckbox);

   function handleDelete() {
     const { onDelete } = useContext(head.current, App.Context);
-    onDelete();
+    onDelete(isDone());
     head.current.remove();
   }

   function handleDone(event) {
     const { onDone } = useContext(head.current, App.Context);
     onDone(event.target.checked);
   }

   return (
     <li ref={head}>
-      <input type="checkbox" onChange={handleDone} />
+      <input type="checkbox" onChange={handleDone} ref={doneCheckbox} />
       <button onClick={handleDelete}>❌</button>
       {text}
     </li>
   );
 }
```

`useCheckbox` is another hook that allows us to easily inspect and modify the
DOM. How it works is left as an exercise to the reader.

## Context that is "below"

So far we had to deal with a pretty difficult issue: Our state is represented in
two places in the DOM. One place is the actual list of TODOs and one is in the
summary section. So, every time we make a change in our state, we had to make
sure the other part of the DOM, the summary, gets updated accordingly. So far it
has been relatively easy to do so because we were able to make incremental
changes to the summary. What if we wanted to get a full representation of our
state, say in order to save it in `localStorage`? I will present the solution
and then explain how it works:

```diff
 import {
   useRefs, useTextInput, useIntContent, createContext, useContext, useCheckbox
 } from './lib/domstatejsx';

 export default function App() {
   const [totalSpan, doneSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
   const [, setTotal] = useIntContent(totalSpan);
   const [, setDone] = useIntContent(doneSpan);

   function onDelete(wasDone) {
     setTotal((prev) => prev - 1);
     setDone((prev) => prev - Number(wasDone));
   }

   function onDone(done) {
     setDone((prev) => prev + (done ? 1 : -1));
   }

   function handleAdd(event) {
     event.preventDefault();
     if (!getNewTodoInputValue()) return;
     todoList.current.append(<Todo text={getNewTodoInputValue()} />);
     setNewTodoInputValue('');
     setTotal((prev) => prev + 1);
+    save();
   }

 
+  function save() {
+    const data = useContext(todoList.current, Todo.Context, { direction: 'down' })
+      .map(({ text, isDone }) => ({ text, done: isDone() }));
+    localStorage.setItem('todos', JSON.stringify(data));
+  }
 
   return (
     <>
       <h1>My TODO application</h1>
       <h2>
         Summary
         <small>
           Total: <span ref={totalSpan}>0</span>,
           done: <span ref={doneSpan}>0</span>
         </small>
       </h2>
       <form onSubmit={handleAdd}>
         <input autofocus ref={newTodoInput} />
         <button>Add</button>
       </form>
-      <App.Context.Provider value={% raw %}{{ onDelete, onDone }}{% endraw %}>
+      <App.Context.Provider value={% raw %}{{ onDelete, onDone, save }}{% endraw %}>
         <ul ref={todoList} />
       </App.Context.Provider>
     </>
   );
 }
 App.Context = createContext();

 function Todo({ text }) {
   const [head, doneCheckbox] = useRefs();
   const [isDone] = useCheckbox(doneCheckbox);

   function handleDelete() {
-    const { onDelete } = useContext(head.current, App.Context);
+    const { onDelete, save } = useContext(head.current, App.Context);
     onDelete(isDone());
     head.current.remove();
+    save();
   }

   function handleDone(event) {
-    const { onDone } = useContext(head.current, App.Context);
+    const { onDone, save } = useContext(head.current, App.Context);
     onDone(event.target.checked);
+    save();
   }

   return (
+    <Todo.Context.Provider value={% raw %}{{ text, isDone }}{% endraw %}>
       <li ref={head}>
         <input type="checkbox" onChange={handleDone} ref={doneCheckbox} />
         <button onClick={handleDelete}>❌</button>
         {text}
       </li>
+    </Todo.Context.Provider>
   );
 }
+Todo.context = createContext();
```

1. We introduced a new context for our TODOs, which means that every TODO that
   is being rendered exposes its text and a function that returns its "done"
   status to the world.

2. The new thing here is that we can retrieve contexts that are "below" us in
   the DOM tree, ie the `App` can get the contexts of all the TODOs. This
   happens by adding the `{ direction: 'down' }` option. When this is set,
   `useContext` will return a list of all the contexts it finds.

3. This allows us to create a list of `{ text, done }` objects that we are then
   able to save to `localStorage`.

4. We expose `App`'s `save` method via its context so that the TODOs can have
   access to it.

5. Every time there is a change to our state, namely when a TODO is added,
   removed or its "done" status is changed, we invoke `save` (notice that we
   invoke save **after** we remove the TODO from the DOM, otherwise, `save`
   would include it).

Now we can make sure that when the application is rendered for the first time,
the state is retrieved from `localStorage` and rendered as `Todo`s.

```diff
 import {
   useRefs, useTextInput, useIntContent, createContext, useContext, useCheckbox
 } from './lib/domstatejsx';

 export default function App() {
   const [totalSpan, doneSpan, newTodoInput, todoList] = useRefs();
   const [getNewTodoInputValue, setNewTodoInputValue] = useTextInput(newTodoInput);
   const [, setTotal] = useIntContent(totalSpan);
   const [, setDone] = useIntContent(doneSpan);

   function onDelete(wasDone) {
     setTotal((prev) => prev - 1);
     setDone((prev) => prev - Number(wasDone));
   }

   function onDone(done) {
     setDone((prev) => prev + (done ? 1 : -1));
   }

   function handleAdd(event) {
     // ...
   }


   function save() {
     const data = useContext(todoList.current, Todo.Context, { direction: 'down' })
       .map(({ text, isDone }) => ({ text, done: isDone() }));
     localStorage.setItem('todos', JSON.stringify(data));
   }
 
+  setTimeout(() => {
+    const data = localStorage.getItem('todos');
+    if (!data) return;
+    todoList.current.replaceChildren(
+      ...JSON.parse(data).map(({ text, done }) => <Todo text={text} done={done} />)
+    );
+    setTotal(data.length);
+    setDone(data.filter(({ done }) => done).length);
+  }, 0);
 
   return (
     // ...
   );
 }
 App.Context = createContext();
 
-function Todo({ text }) {
+function Todo({ text, done = false }) {
   const [head, doneCheckbox] = useRefs();
   const [isDone] = useCheckbox(doneCheckbox);

   function handleDelete() {
     // ...
   }

   function handleDone(event) {
     const { onDone, save } = useContext(head.current, App.Context);
     onDone(event.target.checked);
     save();
   }

   return (
     <Todo.Context.Provider value={% raw %}{{ text, isDone }}{% endraw %}>
       <li ref={head}>
-        <input type="checkbox" onChange={handleDone} ref={doneCheckbox} />
+        <input type="checkbox" checked={done} onChange={handleDone} ref={doneCheckbox} />
         <button onClick={handleDelete}>❌</button>
         {text}
       </li>
     </Todo.Context.Provider>
   );
 }
 Todo.context = createContext();
```

We have to defer loading from `localStorage` (with
`setTimeout(() => { ... }, 0)`) because at that time, the TODO list hasn't been
assigned to the `todoList` ref.

## Combining hooks

Before I leave you, I want to show another example where the state is
represented in two places in the DOM at the same time and some utilities that
can help with dealing with this. Let's assume that we want to add a
"line-through" to the TODO's text if it is "done".

```diff
 import {
-  useRefs, useTextInput, useIntContent, createContext, useContext, useCheckbox
+  useRefs, useTextInput, useIntContent, createContext, useContext, useCheckbox,
+  useStyleBoolean
 } from './lib/domstatejsx';

 export default function App() {
   // ...
 }
 App.Context = createContext();

 function Todo({ text, done = false }) {
-  const [head, doneCheckbox] = useRefs();
+  const [head, doneCheckbox, textSpan] = useRefs();
   const [isDone] = useCheckbox(doneCheckbox);
+  const [, setTextLineThrough] = useStyleBoolean(textSpan, 'text-decoration-line', 'line-through', null);

   function handleDelete() {
     // ...
   }

   function handleDone(event) {
     const { onDone, save } = useContext(head.current, App.Context);
     onDone(event.target.checked);
     save();
+    setTextLineThrough(event.target.checked);
   }

   return (
     <Todo.Context.Provider value={% raw %}{{ text, isDone }}{% endraw %}>
       <li ref={head}>
         <input type="checkbox" checked={done} onChange={handleDone} ref={doneCheckbox} />
         <button onClick={handleDelete}>❌</button>
-        {text}
+        <span style={% raw %}{{ textDecorationLine: done ? 'line-through' : null }}{% endraw %} ref={textSpan}>
+          {text}
+        </span>
       </li>
     </Todo.Context.Provider>
   );
 }
 Todo.context = createContext();
```

`useStyleBoolean` accepts the following arguments:

```javascript
function useStyleBoolean(ref, property, onValue, offValue) { ... }
```

The getter returns whether the CSS `property` has the `onValue` and the setter
accepts a boolean and sets the property to the `onValue` or `offValue`
accordingly.

However we can do better:

```diff
 import {
   useRefs, useTextInput, useIntContent, createContext, useContext, useCheckbox,
-  useStyleBoolean
+  useStyleBoolean, combineHooks
 } from './lib/domstatejsx';

 export default function App() {
   // ...
 }
 App.Context = createContext();

 function Todo({ text, done = false }) {
   const [head, doneCheckbox, textSpan] = useRefs();
-  const [isDone] = useCheckbox(doneCheckbox);
-  const [, setTextLineThrough] = useStyleBoolean(textSpan, 'text-decoration-line', 'line-through', null);
+  const [isDone, setDone] = combineHooks(
+    useCheckbox(doneCheckbox),
+    useStyleBoolean(textSpan, 'text-decoration-line', 'line-through', null),
+  );

   function handleDelete() {
     // ...
   }

   function handleDone(event) {
     const { onDone, save } = useContext(head.current, App.Context);
     onDone(event.target.checked);
     save();
-    setTextLineThrough(event.target.checked);
+    setDone(event.target.checked);
   }

   return (
     // ...
   );
 }
 Todo.context = createContext();
```

`combineHooks` accepts a list of get-set pairs and returns a single get-set pair.

- The combined getter simply invokes the first getter in the arguments and
- The combined setter invokes all setters

What we are doing here is that we are _declaring_ that our "done" state lives in
two places in the DOM. We _declare_ that our "source of truth" for this "done"
state is the checkbox and that we want changes to this state to be reflected in
both places in the DOM. This is done in a way that both makes the code
smaller/simpler and makes our intention clearer. This will become more valuable
as we build more complex applications where we want disable a button and show a
spinner when the contents of a list is loading, when we want to replace a text
with an input to edit it etc.

## Conclusions

I mentioned from the beginning that I don't claim this is a better alternative
than React or other frameworks. I am pretty sure that a benchmark could
demonstrate some performance improvements over React, but this would be heavily
dependent on the scenario being tested. I went through this rabbit-hole
exclusively for the fun of it.

Here are my takeaways while working with this:

- It is tiring and probably error-prone to keep track of when the state changes
  and make sure that all side-effects are triggered properly. For example, if
  we made this TODO application in React and wanted to save changes to
  `localStorage`, all we would have to do would be to add a `useEffect` and we
  would be relatively certain that it would fire when needed.

- In other scenarios, we can expect there to be a lot of hiding and showing DOM
  elements. Think of a form field that needs to optionally show a validation
  error message. With React you could do a `{error && <p>{error}<p>}` and it
  would take care of adding and removing the paragraph during every rerender.
  With `domstatejsx`, we will probably have a
  `<p style={% raw %}{{ display: 'none' }}{% endraw %} />` and use a hook
  setter that shows and hides it depending on whether there is a validation
  error (although it is not unthinkable to add and remove it with javascript).
  This is manageable code-wise - I have already implemented a demo application
  with this functionality - but it is an open question how it will affect
  performance. On the one hand, the paragraph will always be in the DOM, even
  if it isn't shown, on the other hand it may be quicker to show it instead of
  rerendering it.

- There may be cases where the state needs to be remembered but isn't visible
  in the application. Think of a list with checkboxes. When you select an item
  from the list it means that we want to include it in a cart. What if the list
  is paginated? If we consider the "source of truth" for which items are
  selected the checkboxes themselves, then, when we switch to the next page, if
  the previous page is removed then our selections will be lost. We can get
  around this by hiding and showing pages instead of rerendering them but this
  leads to the same questions as before with regards to performance.

I pushed all my experiments to [github](https://github.com/kbairak/domstatejsx)
if you want to play around with this.
