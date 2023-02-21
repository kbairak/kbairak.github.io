---
layout: post
title:  "Only dumb components should have CSS in React"
date:   2023-02-19 19:00:00 +0300
categories: programming react
---

This is going to be my first React-related post. Recently I have been involved
with a big full-stack project and we decided to go with a
single-page-application for its frontend, built with React. React is a
beautiful library but anyone with experience can tell you that with any project
larger than what would suit a tutorial, developers have the freedom to choose
between a million different paths. This is fine, of course, but it means that
it can get difficult for a team to cooperate effectively, especially if a team
member stumbles across a big codebase that someone else has started working on.

After having some experience with this issue, I have a proposal that I hope can
help teams deal with this issue. This all boils down to a single "guideline":

> Components that deal with CSS should have **no state**

This sentence might seem arbitrary. Also it seems that it won't be able to
solve many problems since it still allows a lot of freedom to choose a path at
any given intersection during the development of the project. However, I feel
that it will subtly guide you to good practices and maintainable code.

Let's dive into this sentence a bit. "No state" does not mean 100% dumb (as
opposed to what the title suggests). These components can have conditional
logic, but it will always be based on their props. Also, there's no restriction
on stateless components (with CSS) to render stateful components.

Let's look into this guideline, first with a simple example:

> ### Detour
> 
> I am going to be using [react-query](https://react-query-v3.tanstack.com/) in
> my examples. `react-query` has a lot of features including caching, polling,
> retrying etc, but for the requirements of my example, just know that this:

> ```javascript
> function App() {
>   const { isError, isLoading, data } = useQuery(['data'], async () => {
>     const response = await fetch(...);
>     return (await response.json).data;
>   });
> 
>   return ...;
> }
> ```
> 
> will be equivalent to this:
> 
> ```javascript
> function App() {
>   const [isError, setIsError] = useState(false);
>   const [isLoading, setIsLoading] = useState(true);
>   const [data, setData] = useState([]);
>   useEffect(() => {
>     async function _getData() {
>       try {
>         const response = await fetch(...);
>         setData((await response.json()).data);
>       } catch (error) {
>         setIsError(true);
>       }
>       setIsLoading(false);
>     }
>     _getData();
>   }, []);
> 
>   return ...;
> }
> ```
> 
> And this:
> 
> ```javascript
> function App() {
>   const { mutate, isIdle, isError, isLoading, isSuccess } = useMutation(
>     (choiceId) => fetch(..., { method: 'POST' }),
>   );
> 
>   return ...;
> }
> ```
> 
> will be equivalent to this:
> 
> ```javascript
> function App() {
>   const [isIdle, setIsIdle] = useState(true);
>   const [isError, setIsError] = useState(false);
>   const [isLoading, setIsLoading] = useState(false);
>   const [isSuccess, setIsSuccess] = useState(false);
>   async function mutate(choiceId) {
>     setIsIdle(false);
>     setIsLoading(true);
>     try {
>       await fetch(..., { method: 'POST' });
>     } catch (error) {
>       setIsError(true);
>       setIsLoading(false);
>       return;
>     }
>     setIsLoading(false);
>     setIsSuccess(true);
>   }
> 
>   return ...
> }
> ```
> 
> In essence, react-query abstracts some tedious things you have to do when
> fetching data from a backend or pushing changes to the backend.

## A simple example

We are going to build an application that fetches a list of options from the
backend, presents them to the user and submits the user's choice back to the
backend. Let's assume that the more-backend-savvy-frontend engineer puts their
hands to the task first. They may do something like this:


```javascript
export default function App() {
  const {
    isError: isQueryError,
    isLoading: isQueryLoading,
    data: choices,
  } = useQuery(
    ['choices'],
    async () => {
      const response = await fetch(...);
      return (await response.json()).data;
    }
  );
  const {
    mutate: handleChoice,
    isIdle: isMutationIdle,
    isError: isMutationError,
    isLoading: isMutationLoading,
    isSuccess: isMutationSuccess,
  } = useMutation((choiceId) => fetch(..., { method: 'POST' }));

  if (isQueryError) {
    return 'Error!!!';
  } else if (isQueryLoading) {
    return 'Loading...';
  } else if (isMutationIdle) {
    return (
      <ul>
        {choices.map((choice) => (
          <li key={choice.id}>
            <button onClick={() => handleChoice(choice.id)}>
              {choice.name}
            </button>
          </li>
        ))}
      </ul>
    );
  } else if (isMutationError) {
    return 'Error!!!';
  } else if (isMutationLoading) {
    return 'Saving...';
  } else if (isMutationSuccess) {
    return 'Saved!!!'
  }
}
```

This is a fully functional component that uses the simplest HTML possible. The
function's body is dedicated to the component's functionality only. It's
relatively easy for someone to understand the logic here. If the
more-design-savvy-frontend-engineer comes along and starts adding CSS-related
code, the size of this component can quickly get big and someone coming into
this codebase later will have a hard time following what's going on. How can
the the backend-savvy engineer prepare the ground for the design-savvy
engineer to get into the project and add styling, without affecting the `App`
component's clarity?

```diff
 export default function App() {
   const {
     isError: isQueryError,
     isLoading: isQueryLoading,
     data: choices,
   } = useQuery(
     ['choices'],
     async () => {
       const response = await fetch(...);
       return (await response.json()).data;
     }
   );
   const {
     mutate: handleChoice,
     isIdle: isMutationIdle,
     isError: isMutationError,
     isLoading: isMutationLoading,
     isSuccess: isMutationSuccess,
   } = useMutation((choiceId) => fetch(..., { method: 'POST' }));
+ 
+  let body;
   if (isQueryError) {
-    return 'Error!!!';
+    body = <Error />;
   } else if (isQueryLoading) {
-    return 'Loading...';
+    body = <Spinner />;
   } else if (isMutationIdle) {
-    return (
+    body = (
-      <ul>
+      <ChoiceList>
         {choices.map((choice) => (
-          <li key={choice.id}>
-            <button onClick={() => handleChoice(choice.id)}>
-              {choice.name}
-            </button>
-          </li>
+          <ChoiceList.Item
+            key={choice.id}
+            choice={choice}
+            onSelect={() => handleChoice(choice.id)} />
         ))}
-      </ul>
+      </ChoiceList>
     );
   } else if (isMutationError) {
-    return 'Error!!!';
+    body = <Error />;
   } else if (isMutationLoading) {
-    return 'Saving...';
+    body = <Spinner />;
   } else if (isMutationSuccess) {
-    return 'Saved!!!'
+    body = <Success />;
   }
+
+  return <PageWrapper>{body}</PageWrapper>
 }
+ 
+function PageWrapper({ children }) {
+  // Lots of fancy CSS directives to render a nice container for the whole app
+  return children;
+}
+
+function Error() {
+  // Lots of fancy CSS directives to produce a nice error message
+  return 'Error!!!';
+}
+
+function Spinner() {
+  // Lots of fancy CSS directives to produce a nice spinner
+  return 'Loading...';
+}
+
+function ChoiceList({ children }) {
+  // Lots of fancy CSS directives to produce a fancy container for choices
+  return <ul>{children}</ul>;
+}
+
+ChoiceList.Item = function({ choice, onSelect }) {
+  // Lots of fancy CSS directives to produce a choice and attach the callback
+  // that will occur when the user selects this particular choice
+  return (
+    <li>
+      <button onClick={onSelect}>{choice.name}</button>
+    </li>
+  );
+}
+
+function Success() {
+  // Lots of fancy CSS directives to produce a nice success message
+  return 'Saved!!!';
+}
```

The main takeaway is that main `App` component retains its clarity - its two
incarnations are nearly identical. Also, I believe that it will be manageable
for the design-savvy engineer to add styling to the application.

Let's take a closer look at `ChoiceList.Item = function({ choice, onSelect })`.
My main hope/goal is that when the design-savvy engineer sees that signature
(and the naive implementation), they will be able to figure out how to use the
supplied props.

Now let's assume that the development goes in a different direction, ie that the
design-savvy engineer gets their hand on the project before the backend-savvy
engineer. How would this look like under this new guideline?

```javascript
export default function App() {
  const choices = [
    {id: 1, name: 'Choice 1'},
    {id: 2, name: 'Choice 2'},
    {id: 3, name: 'Choice 3'},
    {id: 4, name: 'Choice 4'},
  ];

  function handleChoice(choiceId) {
    alert(`Choice ${choiceId} selected`);
  }

  return (
    <PageWrapper>
      <ChoiceList>
        {choices.map((choice) =>
          <ChoiceList.Item
            key={choice.id}
            choice={choice}
            onSelect={() => handleChoice(choice.id)} />
        )}
      </ChoiceList>
    </PageWrapper>
  );
}

function PageWrapper({ children }) {
  // Lots of fancy CSS to render a nice container for the whole app
  return ...;
}

function ChoiceList({ children }) {
  // Lots of fancy CSS directives to produce a fancy container for choices, eg
  return ...;
}

ChoiceList.Item = function({ choice, onSelect }) {
  // Lots of fancy CSS directives to produce a choice and attach the callback
  // that will occur when the user selects this particular choice
  return ...;
}

function Error() {
  // Lots of fancy CSS directives to produce a nice error message
  return ...;
}

function Spinner() {
  // Lots of fancy CSS directives to produce a nice spinner
  return ...;
}

function Success() {
  // Lots of fancy CSS directives to produce a nice success message
  return ...;
}
```

So, here the design-savvy engineer has not implemented any state or any of
the interactions with the server, instead they use mock data. However, they
**anticipated** where these would go, namely the `App` component, and kept all
CSS out of it. Now, when the backend-savvy engineer comes along, they will be
able to replace the mock data with the actual state the application will need
in order to function properly. The final incarnation of the application will be
the same in both cases.

## A more complete example

Earlier I said that the problems with react arise when the application is
larger than what would suit a tutorial, then I proceeded to demonstrate such an
application. You can stop reading here if you want. However, in order to better
make my point I will demonstrate my guideline with a larger application.

Let's build a UI for placing orders. This will be implemented as a 3-step wizard.
In the first step the user will choose which products to order, in the second
step they will supply their address and in the third step they will review and
submit the order. We will follow the backend-savvy-first approach. Let's get
started:

### The main component

```javascript
export default function App() {
  const [step, setStep] = useState(1);
  return (
    <>
      {step === 1 && <Step1 onComplete={() => setStep(2)} />}
      {step === 2 && <Step2 onComplete={() => setStep(3)} />}
      {step === 3 && <Step3 />}
    </>
  );
}

function Step1({ onComplete }) {
  return (
    <>
      <p>This is step 1</p>
      <p><button onClick={onComplete}>Next step</button></p>
    </>
  );
}

function Step2({ onComplete }) {
  return (
    <>
      <p>This is step 2</p>
      <p><button onClick={onComplete}>Next step</button></p>
    </>
  );
}

function Step3() {
  return <p>This is step 3</p>;
}
```

### Step 1 - Product list

Now let's display the products while adding pagination to the mix:

```javascript
// Simple awaitable function to cause a delay in order to simulate fetching data
// from the server
function sleep(delay) {
  return new Promise((resolve, _) => {
    setTimeout(resolve, parseInt(delay * 1000, 10));
  });
}

function Step1({ onComplete }) {
  const [page, setPage] = useState(1);
  const { isError, isLoading, data: products } = useQuery(
    ['products', page],
    async () => {
        await sleep(1);
        return [1, 2, 3, 4, 5].map((i) => ({
          id: (page - 1) * 5 + i,
          name: `Product ${(page - 1) * 5 + i}`,
          amount: 100 + ((page - 1) * 5 + i) * 10,
        }));
    },
  );

  if (isError) {
    return 'Error!!!';
  } else if (isLoading) {
    return 'Loading...';
  } else {
    return (
      <>
        <ul>
          {products.map(
            (product) => <li key={product.id}>{product.name} - {product.amount}$</li>
          )}
        </ul>
        <p>
          {page > 1 &&
            <>
              <button onClick={() => setPage((page) => page - 1)}>Previous page</button>
              {' | '}
            </>}
            Page {page}
            {' | '}
            <button onClick={() => setPage((page) => page + 1)}>Next page</button>
        </p>
        <p><button onClick={onComplete}>Next step</button></p>
      </>
    );
  }
}
```

Now let's support selecting products:

```diff
 function Step1({ onComplete }) {
   const [page, setPage] = useState(1);
+  const [selectedProducts, setSelectedProducts] = useState({});
   const { isError, isLoading, data: products } = useQuery(
     ['products', page],
     async () => {
         await sleep(1);
         return [1, 2, 3, 4, 5].map((i) => ({
           id: (page - 1) * 5 + i,
           name: `Product ${(page - 1) * 5 + i}`,
           amount: 100 + ((page - 1) * 5 + i) * 10,
         }));
     },
   );
+ 
+  function onSelect(product) {
+    setSelectedProducts((selectedProducts) => {
+      selectedProducts = { ...selectedProducts };  // Make sure this causes a rerender
+      if (product.id in selectedProducts) {
+        delete selectedProducts[product.id];
+      } else {
+        selectedProducts[product.id] = product;
+      }
+      return selectedProducts;
+    });
+  }
+ 
+  const displayProducts = useMemo(() => (products || []).map(
+    (product) => ({ selected: product.id in (selectedProducts || {}), ...product }),
+  ), [products, selectedProducts]);
+ 
+  const total = useMemo(() => Object.values(selectedProducts || []).reduce(
+    (total, product) => total + product.amount,
+    0,
+  ), [selectedProducts]);
 
   if (isError) {
     return 'Error!!!';
   } else if (isLoading) {
     return 'Loading...';
   } else {
     return (
       <>
+        <p>
+          You have selected {Object.values(selectedProducts || []).length} products -
+          Total amount: {total}
+        </p>

-       <ul>
-         {products.map(
-           (product) => <li key={product.id}>{product.name} - {product.amount}$</li>
-         )}
-       </ul>
+        <ul>
+          {displayProducts.map((product) => (
+            <li key={product.id}>
+              <input
+                type="checkbox"
+                checked={product.selected}
+                onChange={() => onSelect(product)} />
+              {product.name} - {product.amount}$
+            </li>
+          ))}
+        </ul>

         <p>
           {page > 1 &&
             <>
               <button onClick={() => setPage((page) => page - 1)}>Previous page</button>
               {' | '}
             </>}
             Page {page}
             {' | '}
             <button onClick={() => setPage((page) => page + 1)}>Next page</button>
         </p>
         <p><button onClick={onComplete}>Next step</button></p>
       </>
     );
   }
 }
```

Quite a few things going on here:

1. We keep the selected products in a different state variable which has the
   form `{ productId: product, ... }`
2. We implement a function that will toggle whether a product is selected or
   not (add or remove it from `selectedProducts`)
3. We create a modified list of products with the added `selected` field as a
   dependent variable of `products` and `selectedProducts` (with `useMemo`)
4. We create a variable dependent on `selectedProducts` to store the current
   total amount of the order (with `useMemo`)
5. We display an order summary at the top
6. We render a controlled checkbox for each product, linking it to its
   `selected` field and the toggling function

### Step 2 - Address


Let's move on to the second step. Things are much simpler here:

```javascript
function Step2({ onComplete }) {
  const [address, setAddress] = useState('');
  return (
    <>
      <p>
        Your address:
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </p>
      <p><button onClick={onComplete}>Next step</button></p>
    </>
  );
}
```

### Step 3 - Summary and submit

Before moving on to step 3, we have to rethink our state a bit. We want `Step3`
to have access to `selectedProducts` and `address` in order for it to display
the summary and place the order. Which means that we will need to "bump" these
state variables from their respective components to `App`:

```diff
 export default function App() {
   const [step, setStep] = useState(1);
+ 
+  const [selectedProducts, setSelectedProducts] = useState({});
+  const [address, setAddress] = useState('');
+ 
+  function onSelectProduct(product) {
+    setSelectedProducts((selectedProducts) => {
+      selectedProducts = { ...selectedProducts };  // Make sure this causes a rerender
+      if (product.id in selectedProducts) {
+        delete selectedProducts[product.id];
+      } else {
+        selectedProducts[product.id] = product;
+      }
+      return selectedProducts;
+    });
+  }

   return (
     <>
-      {step === 1 && <Step1 onComplete={() => setStep(2)} />}
+      {step === 1 &&
+        <Step1
+          onComplete={() => setStep(2)}
+          selectedProducts={selectedProducts}
+          onSelect={onSelectProduct} />}
-      {step === 2 && <Step2 onComplete={() => setStep(3)} />}
+      {step === 2 &&
+        <Step2
+          onComplete={() => setStep(3)}
+          address={address}
+          setAddress={setAddress} />}
-      {step === 3 && <Step3 />}
+      {step === 3 && <Step3 selectedProducts={selectedProducts} address={address} />}
     </>
   );
 }
- 
-function Step1({ onComplete }) {
+function Step1({ onComplete, selectedProducts, onSelect }) {
   const [page, setPage] = useState(1);
-  const [selectedProducts, setSelectedProducts] = useState({});
   const { isError, isLoading, data: products } = useQuery(
     ['products', page],
     async () => {
         await sleep(1);
         return [1, 2, 3, 4, 5].map((i) => ({
           id: (page - 1) * 5 + i,
           name: `Product ${(page - 1) * 5 + i}`,
           amount: 100 + ((page - 1) * 5 + i) * 10,
         }));
     },
   );
- 
-  function onSelect(product) {
-    setSelectedProducts((selectedProducts) => {
-      selectedProducts = { ...selectedProducts };  // Make sure this causes a rerender
-      if (product.id in selectedProducts) {
-        delete selectedProducts[product.id];
-      } else {
-        selectedProducts[product.id] = product;
-      };
-      return selectedProducts;
-    });
-  }

   const displayProducts = useMemo(() => (products || []).map(
     (product) => ({ selected: product.id in selectedProducts, ...product }),
   ), [products, selectedProducts]);

   const total = useMemo(() => Object.values(selectedProducts || []).reduce(
     (total, product) => total + product.amount,
     0,
   ), [selectedProducts]);
 
   // ...
 }
- 
-function Step2({ onComplete }) {
+function Step2({ onComplete, address, setAddress }) {
-  const [address, setAddress] = useState('');
   return (
     <>
       <p>
         Your address:
         <input value={address} onChange={(e) => setAddress(e.target.value)} />
       </p>
       <p>
         <button onClick={onComplete}>Next step</button>
       </p>
     </>
   );
 }
```

Now we can move on to step 3:

```javascript
function Step3({ selectedProducts, address }) {
  const { mutate, isIdle, isError, isLoading, isSuccess } = useMutation(() => sleep(1));

  const total = useMemo(() => Object.values(selectedProducts || []).reduce(
    (total, product) => total + product.amount,
    0,
  ), [selectedProducts]);

  return (
    <>
      <p>You have selected the following products</p>
      <ul>
        {Object.values(selectedProducts || []).map(
          (product) => <li key={product.id}>{product.name} - {product.amount}$</li>
        )}
      </ul>
      <p>Your address is: {address}</p>
      <p>The total amount is: {total}$</p>
      {isIdle && <button onClick={mutate}>Submit order</button>}
      {isError && 'Error!!!'}
      {isLoading && 'Placing order...'}
      {isSuccess && 'Order placed!!!'}
    </>
  );
}
```

You can check the full application [here](https://codesandbox.io/s/adoring-booth-48veet?file=/src/App.js)

### Adding style

So, now it's time to put my guideline to the test: If we include styling but
not in any stateful components, can we, at the same time:

1. Keep the frontend business logic as clear and readable as it is now
2. Allow us to apply a beautiful style (keeping in mind that I am no designer :p )

By the way, we will be using [tailwind](https://tailwindcss.com/) for styling.

Let's start with a nice header:

```diff
 export default function App() {
   // ...
 
   return (
-    <>
+    <PageWrapper>
       {step === 1 &&
         <Step1
           onComplete={() => setStep(2)}
           selectedProducts={selectedProducts}
           onSelect={onSelectProduct} />}
       {step === 2 &&
         <Step2
           onComplete={() => setStep(3)}
           address={address}
           setAddress={setAddress} />}
       {step === 3 && <Step3 selectedProducts={selectedProducts} address={address} />}
-     </>
+     </PageWrapper>
    );
 }
+ 
+function PageWrapper({ children }) {
+  return (
+    <div className='container mx-auto'>
+      <h1 className='font-serif text-2xl border-b-4'>kbairak's shop</h1>
+      {children}
+    </div>
+  );
+}
```

Let's move on with beefing up step 1

```diff
 function Step1({ onComplete, selectedProducts, onSelect }) {
   // ...
+  let body;
   if (isError) {
-    return 'Error!!!';
+    body = 'Error!!!';
   } else if (isLoading) {
-    return 'Loading...';
+    body = <Spinner />;
   } else {
-    return (
-      <>
-        <p>
-          You have selected {Object.values(selectedProducts || []).length} products -
-          Total amount: {total}
-        </p>
-
-        <ul>
-          {displayProducts.map((product) => (
-            <li key={product.id}>
-              <input
-                type="checkbox"
-                checked={product.selected}
-                onChange={() => onSelect(product)} />
-              {product.name} - {product.amount}$
-            </li>
-          ))}
-        </ul>
-
-        <p>
-          {page > 1 &&
-            <>
-              <button onClick={() => setPage((page) => page - 1)}>Previous page</button>
-              {' | '}
-            </>}
-            Page {page}
-            {' | '}
-            <button onClick={() => setPage((page) => page + 1)}>Next page</button>
-        </p>
-        <p><button onClick={onComplete}>Next step</button></p>
-      </>
-    );
+    body = (
+      <Products products={displayProducts} onSelect={onSelect} />
+    );
   }
+  return (
+    <>
+      <SummaryMessage>
+        Selected {selectedProducts.length} products - Amount: {total}$
+      </SummaryMessage>
+      {body}
+      <Pagination page={page} setPage={setPage} />
+      <BigButton onClick={onComplete}>Next step</BigButton>
+    </>
+  );
 }
+ 
+function SummaryMessage({ children }) {
+  return (
+    <div className='my-6 mx-60 p-3 border-4 rounded-lg text-right'>{children}</div>
+  );
+}
+ 
+function Spinner({ children = 'Loading', interval = 50, length = 8 }) {
+  const [dots, setDots] = useState(0);
+  useEffect(() => {
+    const intervalId = setInterval(() => {
+      setDots((dots) => {
+        dots += 1;
+        while (dots > length) { dots -= length; }
+        return dots;
+      });
+    }, interval)
+    return () => {
+      clearInterval(intervalId);
+    };
+  }, []);
+
+  return <>{children}{'.'.repeat(dots)}</>;
+}
+ 
+function Products({ products, onSelect }) {
+  return (
+    <table className='w-full'>
+      <thead>
+        <tr className='bg-slate-50'>
+          <th className='border-2'/>
+          <th className='border-2 text-left'>Name</th>
+          <th className='border-2 text-left'>Price</th>
+        </tr>
+      </thead>
+      <tbody>
+        {(products || []).map((product) => (
+          <tr key={product.id}>
+            <td className='border-2'>
+              <input
+                type="checkbox"
+                checked={product.selected}
+                onChange={() => onSelect(product)} />
+            </td>
+            <td className='border-2'>{product.name}</td>
+            <td className='border-2'>{product.amount}$</td>
+          </tr>
+        ))}
+      </tbody>
+    </table>
+  );
+}
+ 
+function Pagination({ page, setPage }) {
+  return (
+    <div className='flex gap-x-6'>
+      <div className='flex-grow' />
+      {page > 1 && (
+        <div className='flex-0'>
+          <button onClick={() => setPage((page) => page - 1)}>previous</button>
+        </div>
+      )}
+      <div className='flex-0'>
+        {page}
+      </div>
+      <div className='flex-0'>
+        <button onClick={() => setPage((page) => page + 1)}>next</button>
+      </div>
+    </div>
+  );
+}
+ 
+function BigButton({ onClick, children }) {
+  return (
+    <div className='flex'>
+      <div className='flex-grow' />
+      <div>
+        <button
+          className='m-2 p-2 bg-green-500 rounded-lg font-bold text-white'
+          onClick={onClick}>
+          {children}
+        </button>
+      </div>
+    </div>
+  );
+}
```

Step 2 is already stateless, so we are "allowed" to add CSS in it:

```diff
 function Step2({ onComplete, address, setAddress }) {
   return (
     <>
-      <p>
-        Your address:
-        <input value={address} onChange={(e) => setAddress(e.target.value)} />
-      </p>
+      <div className='my-6 mx-60 p-3 border-4 rounded-lg text-xl flex'>
+        <div className='flex-0'>
+          Address:
+        </div>
+        <div className='flex-grow pr-8'>
+          <input
+            value={address}
+            onChange={(e) => setAddress(e.target.value)}
+            className='border-2 ml-6 w-full' />
+        </div>
+      </div>
-      <p>
-        <button onClick={onComplete}>Next step</button>
-      </p>
+      <BigButton onClick={onComplete}>Next step</BigButton>
     </>
   );
 }
```

And finally: Step 3

```diff
 function Step3({ selectedProducts, address }) {
   // ...
 
   return (
     <>
-      <p>You have selected the following products</p>
+      <BigText>You have chosen to order the following products:</BigText>
-      <ul>
-        {Object.values(selectedProducts).map(
-          (product) => <li key={product.id}>{product.name} - {product.amount}$</li>
-        )}
-      </ul>
+      <Products products={Object.values(selectedProducts)}/>
-      <p>Your address is: {address}</p>
-      <p>The total amount is: {total}$</p>
+      <SummaryMessage>
+        <p>Total amount:{total}$</p>
+        <p>Your address is: {address}</p>
+      </SummaryMessage>
-      {isIdle && <button onClick={mutate}>Submit order</button>}
+      {isIdle && <BigButton onClick={mutate}>Submit order</BigButton>}
-      {isError && 'Error!!!'}
+      {isError && <BigText>Error!!!</BigText>}
-      {isLoading && 'Placing order...'}
+      {isLoading && <Spinner>Placing order...</Spinner>}
-      {isSuccess && 'Order placed!!!'}
+      {isSuccess && <BigText>Order placed!!!</BigText>}
     </>
   );
 }

 function Products({ products, onSelect }) {
   return (
     <table className='w-full'>
       <thead>
         <tr className='bg-slate-50'>
-          <th className='border-2'/>
+          {onSelect && <th className='border-2'/>}
           <th className='border-2 text-left'>Name</th>
           <th className='border-2 text-left'>Price</th>
         </tr>
       </thead>
       <tbody>
         {(products || []).map((product) => (
           <tr key={product.id}>
-            <td className='border-2'>
-              <input
-                type="checkbox"
-                checked={product.selected}
-                onChange={() => onSelect(product)} />
-            </td>
+            {onSelect &&
+              <td className='border-2'>
+                <input
+                  type="checkbox"
+                  checked={product.selected}
+                  onChange={() => onSelect(product)} />
+              </td>}
             <td className='border-2'>{product.name}</td>
             <td className='border-2'>{product.amount}$</td>
           </tr>
         ))}
       </tbody>
     </table>
   );
 }
+ 
+function BigText({ children }) {
+  return <div className='text-xl p-4'>{children}</div>;
+}
```

Step 3 is interesting. We are already seeing some stateless components that are
suitable for re-use, like `SummaryMessage`, `Spinner` and `BigButton`. What's
more, when it became evident that we would need a table for the products again,
it didn't make sense to make another, non-editable, product table component.
The existing component could be modified so that if the select callback is
missing, the leftmost column doesn't get rendered. While this makes the
component less dumb, the conditional logic is only applied on its props. It
continues to not have state. This also makes some sense even if you read this
component in isolation: If there is no callback function to notify that the
products were un/selected, it doesn't make sense to render the UI elements that
make this possible.

The whole application can be viewed
[here](https://codesandbox.io/s/tailwind-css-and-react-forked-hi13df). Behold
my amazing UI design skills!!!

We can verify that my guideline was followed since any components that has
state (either via `useState`, `useQuery` or `useMutation`) doesn't have a
`className` within it and any components that have `className` within them
don't have any state. My hope is that by following these guidelines, both
state-ful and style-ful components are easier to read. Also, if you look at the
state-ful components, they keep almost the same logic and structure as they had
before we started adding styles.
