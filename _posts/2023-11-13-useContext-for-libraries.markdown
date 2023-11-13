---
layout: post
title:  "Using useContext for reusable components in React"
date:   2023-11-12 19:00:00 +0300

categories: programming react
---

`useContext` is one of the standard ways to manage state and data in a React
application. Usually, it allows you to create kind-of global variables so that
you don't have to import and/or pass properties around all the time. If you
want a comprehensive guide on why it exists and how to use it, you can consult
the excellent [official docs](https://react.dev/reference/react/useContext).
Here is the speed-run version:

Suppose you have this React app (for some reason):

```javascript
export default function App() {
  return <A msg="world" />;
}

function A({ msg }) {
  return <B msg={msg} />;
}

function B({ msg }) {
  return <C msg={msg} />;
}

function C({ msg }) {
  return <D msg={msg} />;
}

function D({ msg }) {
  return `Hello ${msg}`;
}
```

Here we are passing the `msg` prop from `App` to `A`, from `A` to `B` etc until
it reaches component `D` which actually uses it. You can simplify this code
slightly by doing:

```javascript
import { createContext, useContext } from 'react';

const MyContext = createContext();

export default function App() {
  return (
    <MyContext.Provider value={% raw %}{{ msg: 'world' }}{% endraw %}>
      <A />
    </MyContext.Provider>
  );
}

function A() {
  return <B />;
}

function B() {
  return <C />;
}

function C() {
  return <D />;
}

function D() {
  const { msg } = useContext(MyContext);
  return `Hello ${msg}`;
}
```

So, now we are passing the variable directly from `App` to `D`. The `MyContext`
variable is like a handle that lets both know that they are referring to the
same context; so long as they both have access to it, `App` can _provide_ the
value and `D` can _use_ it, regardless of whether the intermediate components
know about it.

This can be very useful for cases when your main App handles authentication and
a descendant component, possibly rendered by a router, wants access to the
authentication information:

```javascript
// AuthContext.js
import { createContext } from 'react';

const AuthContext = createContext({});
export default AuthContext;

// App.jsx
import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import AuthContext from './AuthContext';
import router from './router';

export default function App() {
  const [authInfo, setAuthInfo] = useState({ loggedIn: false });
  useEffect(() => {
    async function _login() {
      const response = await fetch('/identity');
      const data = await response.json();
      setAuthInfo(data);
    }
    _login();
  }, []);

  return (
    <AuthContext.Provider value={% raw %}{{ authInfo }}{% endraw %}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  );
}

// routes/about.jsx
import { useContext } from 'react';
import { Redirect } from 'react-router-dom';
import AuthContext from '../AuthContext';

export default function About() {
  const { authInfo } = useContext(AuthContext);

  if (! authInfo.loggedIn) { return <Redirect to="/signin" />; }

  // ...
}
```

But enough of that. This is well-known or at least well-documented. Here we
will use `useContext` to build something that would otherwise be difficult to
do without it. A reusable Accordion component. Here is this component's
interface:

```javascript
export default function App() {
  return (
    <Accordion>
      <Accordion.Item trigger="trigger 1">Content 1</Accordion.Item>
      <Accordion.Item trigger="trigger 2">Content 2</Accordion.Item>
      <Accordion.Item trigger="trigger 3">Content 3</Accordion.Item>
      <Accordion.Item trigger="trigger 4">Content 4</Accordion.Item>
    </Accordion>
  );
}
```

We could have passed the triggers and contents as props and, had we done that,
it would have been pretty easy to implement without needing `useContext` at
all, like this:

```javascript
export default function App() {
  return (
    <Accordion items={[
      { trigger: 'trigger 1', content: 'Content 1' },
      { trigger: 'trigger 2', content: 'Content 2' },
      { trigger: 'trigger 3', content: 'Content 3' },
      { trigger: 'trigger 4', content: 'Content 4' },
    ]} />
  );
}
```

The reason we will go with the first approach is that we may want to intersect
custom JSX code inbetween the items, which is something we cannot do with the
props approach:

```javascript
export default function App() {
  return (
    <Accordion>
      <h3>Primary items</h3>
      <Accordion.Item trigger="trigger 1">Content 1</Accordion.Item>
      <Accordion.Item trigger="trigger 2">Content 2</Accordion.Item>
      <h3>Secondary items</h3>
      <Accordion.Item trigger="trigger 3">Content 3</Accordion.Item>
      <Accordion.Item trigger="trigger 4">Content 4</Accordion.Item>
    </Accordion>
  );
}
```

What we want to achieve is to present a list of buttons (or other clickable
element) for each item that will act as a _trigger_. Every time we click one,
its content, and only its content, will be revealed, hiding everything else.
The _state_ that describes which item is to be shown lives in the parent
`Accordion` component (you could say that the parent component defines the
_context_ of which item is currently visible).

The problem is that the parent component does not _know_ what accordion items
live beneath it so it doesn't have direct control of them. The situation looks
like this:

```
<Accordion>       // Library code
  <h3>...           // User's JSX
  <Accordion.Item...  // Library code
```

Anyway, lets start:

```javascript
export default function Accordion({ children }) {
  return children;
}

function AccordionItem({ trigger, children }) {
  return (
    <>
      <div><button>{trigger}</button></div>
      <div>{children}</div>
    </>
  );
}
Accordion.Item = AccordionItem;
```

Lets assume each accordion item has its own `id` (somehow). Which item is open
will be defined by a state variable that lives inside `Accordion`:

```diff
+import { useState } from 'react';

 export default function Accordion({ children }) {
+  const [openId, setOpenId] = useState(null);
   return children;
 }
 
 function AccordionItem({ trigger, children }) {
   return (
     <>
       <div><button>{trigger}</button></div>
       <div>{children}</div>
     </>
   );
 }
 Accordion.Item = AccordionItem;
```

Lets use a context to make sure the required information is passed down to all
items:

```diff
-import { useState } from 'react';
+import { createContext, useState, useContext } from 'react';
 
+const AccordionContext = createContext();

 export default function Accordion({ children }) {
   const [openId, setOpenId] = useState(null);
-  return children;
+  return (
+    <AccordionContext.Provider value={% raw %}{{ openId, setOpenId }}{% endraw %}>
+      {children}
+    </AccordionContext.Provider>
+  );
 }
 
 function AccordionItem({ trigger, children }) {
+  const { openId, setOpenId } = useContext(AccordionContext);
   return (
     <>
       <div><button>{trigger}</button></div>
       <div>{children}</div>
     </>
   );
 }
 Accordion.Item = AccordionItem;
```

So now, even though we don't know the content of `children` of the main
`Accordion` component in advance, we can be certain that **all** items that are
or will be in it will have access to our context.

Now we can use the [`useId`](https://react.dev/reference/react/useId) hook to
give each item its own **unique** ID:

```diff
-import { createContext, useState, useContext } from 'react';
+import { createContext, useState, useContext, useId } from 'react';

 const AccordionContext = createContext();

 export default function Accordion({ children }) {
   const [openId, setOpenId] = useState(null);
   return (
     <AccordionContext.Provider value={% raw %}{{ openId, setOpenId }}{% endraw %}>
       {children}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
   const { openId, setOpenId } = useContext(AccordionContext);
+  const id = useId();
   return (
     <>
       <div><button>{trigger}</button></div>
       <div>{children}</div>
     </>
   );
 }
 Accordion.Item = AccordionItem;
```

And now we can bring everything together:

```diff
 import { createContext, useState, useContext, useId } from 'react';

 const AccordionContext = createContext();

 export default function Accordion({ children }) {
   const [openId, setOpenId] = useState(null);
   return (
     <AccordionContext.Provider value={% raw %}{{ openId, setOpenId }}{% endraw %}>
       {children}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
   const { openId, setOpenId } = useContext(AccordionContext);
   const id = useId();
   return (
     <>
-      <div><button>{trigger}</button></div>
+      <div><button onClick={() => setOpenId(id)}>{trigger}</button></div>
-      <div>{children}</div>
+      {openId === id && <div>{children}</div>}
     </>
   );
 }
 Accordion.Item = AccordionItem;
```

It would be slightly better if the item was not aware of the internals of
`setOpenId`. To that end, we can do:

```diff
 import { createContext, useState, useContext, useId } from 'react';

 const AccordionContext = createContext();

 export default function Accordion({ children }) {
   const [openId, setOpenId] = useState(null);
 
+  function toggle(id) {
+    setOpenId(id);
+  }

   return children;
   return (
-    <AccordionContext.Provider value={% raw %}{{ openId, setOpenId }}{% endraw %}>
+    <AccordionContext.Provider value={% raw %}{{ openId, toggle }}{% endraw %}>
       {children}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
-  const { openId, setOpenId } = useContext(AccordionContext);
+  const { openId, toggle } = useContext(AccordionContext);
   const id = useId();
   return (
     <>
-      <div><button onClick={() => setOpenId(id)}>{trigger}</button></div>
+      <div><button onClick={() => toggle(id)}>{trigger}</button></div>
       {openId === id && <div>{children}</div>}
     </>
   );
 }
 Accordion.Item = AccordionItem;
```

Now we have a solid foundation for adding features. First we are going to make
it so that if you click the trigger of the already open element, it will close:

```diff
 import { createContext, useState, useContext, useId } from 'react';

 const AccordionContext = createContext();

 export default function Accordion({ children }) {
   const [openId, setOpenId] = useState(null);

   function toggle(id) {
-    setOpenId(id);
+    setOpenId(id === openId ? null : id);
   }

   return (
     <AccordionContext.Provider value={% raw %}{{ openId, toggle }}{% endraw %}>
       {children}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
   // ...
 }
 Accordion.Item = AccordionItem;
```

Next we are going to optionally make the accordion a "multi-accordion",
meaning that we will allow multiple items to be open at the same time. But
before that, we are going to convert our state variable from a null/string
value to a
[Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
value:

```diff
 import { createContext, useState, useContext, useId } from 'react';

 const AccordionContext = createContext();

 export default function Accordion({ children }) {
-  const [openId, setOpenId] = useState(null);
+  const [openIds, setOpenIds] = useState(new Set([]));

   function toggle(id) {
-    setOpenId(id === openId ? null : id);
+    setOpenIds(new Set(openIds.has(id) ? [] : [id]));
   }

   return (
     <AccordionContext.Provider value={% raw %}{{ openId, toggle }}{% endraw %}>
       {children}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
   const { openId, toggle } = useContext(AccordionContext);
   const id = useId();
   return (
     <>
       <div><button onClick={() => toggle(id)}>{trigger}</button></div>
-      {openId === id && <div>{children}</div>}
+      {openIds.has(id) && <div>{children}</div>}
     </>
   );
 }
 Accordion.Item = AccordionItem;
```

> Remember, when setting state variables, we have to set _copies_ of our
> previous values instead of mutating them.

And now we can go ahead with implementing the multi functionality:

```diff
 import { createContext, useState, useContext, useId } from 'react';

 const AccordionContext = createContext();

-export default function Accordion({ children }) {
+export default function Accordion({ multi = false, children }) {
   const [openIds, setOpenIds] = useState(new Set([]));

   function toggle(id) {
-    setOpenIds(new Set(openIds.has(id) ? [] : [id]));
+    setOpenIds((prev) => {
+      if (multi) {
+        const result = new Set(prev);
+        (result.has(id) ? result.delete : result.add).call(result, id);
+        return result;
+      } else {
+        return new Set(openIds.has(id) ? [] : [id]);
+      }
+    });
   }

   return (
     <AccordionContext.Provider value={% raw %}{{ openId, toggle }}{% endraw %}>
       {children}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
   // ...
 }
 Accordion.Item = AccordionItem;
```

And our final trick will be to allow "expand all"/"collapse all" buttons to be
possible. We are going to start by making the parent `Accordion` component
_aware_ of all the IDs defined by the items:

```diff
-import { createContext, useState, useContext, useId } from 'react';
+import { createContext, useState, useContext, useId, useEffect } from 'react';

 const AccordionContext = createContext();

 export default function Accordion({ multi = false, children }) {
   const [openIds, setOpenIds] = useState(new Set([]));
+  const [allIds, setAllIds] = useState(new Set([]));

   function toggle(id) {
     // ...
   }
 
+  function registerId(id) {
+    setAllIds((prev) => new Set([...prev, id]));
+  }
 
+  function unregisterId(id) {
+    setAllIds((prev) => {
+      const result = new Set(prev);
+      result.delete(id);
+      return result;
+    });
+  }

   return (
-    <AccordionContext.Provider value={% raw %}{{ openId, toggle }}{% endraw %}>
+    <AccordionContext.Provider value={% raw %}{{ openId, toggle, registerId, unregisterId }}{% endraw %}>
       {children}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
-  const { openId, toggle } = useContext(AccordionContext);
+  const { openId, toggle, registerId, unregisterId } = useContext(AccordionContext);
   const id = useId();
 
+  useEffect(() => {
+    registerId(id);
+    return () => unregisterId(id);
+  }, []);

   return (
     <>
       <div><button onClick={() => toggle(id)}>{trigger}</button></div>
       {openIds.has(id) && <div>{children}</div>}
     </>
   );
 }
 Accordion.Item = AccordionItem;
```

> We use an effect to make sure each item _registers_ its ID when it is mounted
> to the DOM and _unregisters_ it when it is unmounted. This will work even for
> accordion items that are conditionally or dynamically generated.

And, in order to allow exposing the new buttons to the user of our library, we
are going to allow optionally accepting the `Accordion`'s `children` property
as a function that will receive proper callbacks:

```diff
 import { createContext, useState, useContext, useId, useEffect } from 'react';

 const AccordionContext = createContext();

 export default function Accordion({ multi = false, children }) {
   const [openIds, setOpenIds] = useState(new Set([]));
   const [allIds, setAllIds] = useState(new Set([]));

   function toggle(id) {
     // ...
   }

   function registerId(id) {
     // ...
   }

   function unregisterId(id) {
     // ...
   }

   return (
     <AccordionContext.Provider value={% raw %}{{ openId, toggle, registerId, unregisterId }}{% endraw %}>
-      {children}
+      {typeof children !== 'function' && children}
+      {typeof children === 'function' && children({
+        collapseAll: () => setOpenIds(new Set([])),
+        expandAll: () => setOpenIds(new Set([...allIds])),
+      })}
     </AccordionContext.Provider>
   );
 }
 
 function AccordionItem({ trigger, children }) {
   // ...
 }
 Accordion.Item = AccordionItem;
```

So now the user can do this:

```javascript
import Accordion from 'Accordion';

export default function App() {
  return (
    <Accordion multi>
      {({ collapseAll, expandAll }) => (
        <>
          <button onClick={collapseAll}>Collapse all</button>
          <button onClick={expandAll}>Expand all</button>
          <Accordion.Item trigger="trigger 1">Content 1</Accordion.Item>
          <Accordion.Item trigger="trigger 2">Content 2</Accordion.Item>
          <Accordion.Item trigger="trigger 3">Content 3</Accordion.Item>
          <Accordion.Item trigger="trigger 4">Content 4</Accordion.Item>
        </>
      )}
    </Accordion>
  );
}
```
