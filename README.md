# RHSX
RHSX (Richmond Hill Stock Exchange) is an order-driven exchange used by Richmond Hill High School's Finance Club. It includes a discord bot which users can interact with and an API to fetch data.

## Public Slash Commands
Optional parameters are *italicized*.

### /join
Adds a user to the exchange, allowing them to trade

### /trader info
Displays the user's general account information

### /trader position
Displays the user's current positions

### /submit limit [ticker] [direction] [quantity] [limit_price]
Submits a limit order

### /submit market [ticker] [direction] [quantity]
Submits a market order

### /submit stop limit [ticker] [trigger_price] [direction] [quantity] [limit_price]
Submits a stop order that when triggered, submits a limit order

### /submit stop market [ticker] [trigger_price] [direction] [quantity]
Submits a stop order that when triggered, submits a market order

### /orders find [order_id]
Finds an order with the specified id

### /orders query [*type*] [*direction*] [*ticker*] [*status*]
Queries the user's orders given the specified filters

### /orders cancel [order_id]
Cancels the order with the specified id

### /check
Check if the bot is alive

## Admin Slash Commands

### /admin market open
Opens the market, allowing orders to be submitted and processed

### /admin market close
Closes the market<br>
When the market is closed, no orders can be submitted. However, previously submitted orders can still be cancelled.

### /admin bot snapshot
Returns a file containing the objects stored in the bot's cache

### /admin bot experiment
Used to test experimental commands or features
