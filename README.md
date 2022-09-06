# rhsx-bot
rhsx-bot is an interactive Discord bot where users can trade fictitious stocks.

## Commands

### /join
Turns a user into trader, granting access to the trading platform.

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
