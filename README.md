```js
let fltr = require('fltrjson')
```

## Installation

```bash
$ npm install fltrjson
```

## Features

  * Filter JSON
  * MongoDB like Queries
  * Promises
  * Numbers
  * Strings
  * Dates
  * Arrays
  * Objects

## Examples

```js
let fltr = require('fltrjson');

let query = {count: {$gt: 3, $lt: 9}};

let json = {count: 6}

new fltr(query).match(json).then(()=> {console.log('Yay!)}).catch(()=> {console.err('Oh noes!')});
```