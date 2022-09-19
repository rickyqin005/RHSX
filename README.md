# RHSX
RHSX is a trading platform used by Richmond Hill High School's Finance Club. It includes a discord bot where users can interact with to trade fictitious stocks and an API to fetch data.

## Discord Slash Commands
Optional parameters are *italicized*.

### /join
Adds a user to the trader list, granting access to the platform.

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
Querys orders given the specified parameters.

### /orders cancel [order_id]
Cancels the order with the specified id.
