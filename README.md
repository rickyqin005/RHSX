# RHSX
RHSX is an order-driven trading platform used by Richmond Hill High School's Finance Club. It includes a discord bot which users can interact with and an API to fetch data.

## Discord Slash Commands
Optional parameters are *italicized*.

### /join
Adds a user to the trading platform, allowing them to trade.

### /trader info
Displays the user's general account information.

### /trader position
Displays the user's current positions.

### /submit limit [ticker] [direction] [quantity] [limit_price]
Submits a limit order.

### /submit market [ticker] [direction] [quantity]
Submits a market order.

### /submit stop limit [ticker] [trigger_price] [direction] [quantity] [limit_price]
Submits a stop order that when triggered, submits a limit order.

### /submit stop market [ticker] [trigger_price] [direction] [quantity]
Submits a stop order that when triggered, submits a market order.

### /orders find [order_id]
Finds an order with the specified id.

### /orders query [*type*] [*direction*] [*ticker*] [*status*]
Queries the user's orders given the specified filters.

### /orders cancel [order_id]
Cancels the order with the specified id.

### /market open
Opens the market, allowing orders the be submitted and processed. Only users with `Administrator` permissions can use this command.

### /market close
Closes the market. When the market is closed, no orders can be submitted. However, previously submitted orders can still be cancelled. Only users with `Administrator` permissions can use this command.