// Setting up the bot
const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => res.send('this is a bot'));
app.listen(port, () => console.log(`listening at port ${port}`));

// Bot
const {Client, Intents} = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES]});

// Traders
const traders = new Map();

function isValidTrader(user) {
  return (traders.get(user) != undefined);
}

class Trader {
  static STARTING_AMOUNT = 10000;
  #user;
  #balance;
  #orders = [];
  constructor(user) {
    this.#user = user;
    this.#balance = Trader.STARTING_AMOUNT;
  }
  
  toString() {
    let str = '';
    str += `Username: ${this.#user.tag}` + '\n';
    str += `Balance: ${this.#balance}` + '\n';
    for(let i = 0; i < orders.length; i++) {
        str += orders[i].to
    }
  }

  getUser() {
    return this.#user;
  }
  getBalance() {
    return this.#balance;
  }
  getOrders() {
    return this.#orders;
  }
  
  addOrder(order) {
    this.#orders.push(order);
  }
}

// Orders
class Order {
  static #nextId = 1;
  static #getNextId() {
    return this.#nextId++;
  }
  static NOT_FILLED = 0;
  static PARTIALLY_FILLED = 1;
  static COMPLETELY_FILLED = 2;
  
  #id;
  #user;
  #direction;
  #type;
  #ticker;
  #quantity;
  #quantityFilled;
  #price;
  
  constructor(user, direction, type, ticker, quantity, price) {
    this.#id = Order.#getNextId();
    this.#user = user;
    this.#direction = direction;
    this.#type = type;
    this.#ticker = ticker;
    this.#quantity = quantity;
    this.#quantityFilled = 0;
    this.#price = price;
  }

  toString() {
    return `Id: ${this.#id}, User: ${this.#user.tag}, ${this.#direction} ${this.#type} x${this.getQuantity()} (x${this.getQuantityFilled()} filled) ${this.#ticker} @${this.#price}`;
  }

  toShortString() {
    return `Id: ${this.#id}, ${this.#direction} ${this.#type} x${this.getQuantity()} ${this.#ticker} @${this.#price}`;
  }

  orderSubmittedString() {
    return `${getPingString(this.#user)} Your order: \`${this.toShortString()}\` is submitted.`;
  }

  orderFilledString() {
    return `${getPingString(this.#user)} Your order: \`${this.toShortString()}\` is filled.`;
  }

  getId() {
    return this.#id;
  }
  getUser() {
    return this.#user;
  }
  getDirection() {
    return this.#direction;
  }
  getType() {
    return this.#type;
  }
  getTicker() {
    return this.#ticker;
  }
  getQuantity() {
    return this.#quantity;
  }
  getQuantityFilled() {
    return this.#quantityFilled;
  }

  getStatus() {
    if(this.#quantityFilled == 0) return Order.NOT_FILLED;
    else if(this.#quantityFilled < this.#quantity) return Order.PARTIALLY_FILLED;
    else if(this.#quantityFilled == this.#quantity) return Order.COMPLETELY_FILLED;
  }
  
  increaseQuantityFilled(amount, channel) {
    this.#quantityFilled += amount;

    switch(this.getStatus()) {
      case Order.NOT_FILLED:
        break;

      case Order.PARTIALLY_FILLED:
        break;

      case Order.COMPLETELY_FILLED:
        channel.send(this.orderFilledString());
        break;
        
    }
    return this.getStatus();
  }
  getQuantityUnfilled() {
    return this.#quantity - this.#quantityFilled;
  }
  getPrice() {
    return this.#price;
  }
}

class PriorityQueue {
  #array = [];
  #comparator;
  constructor(comparator) {
    this.#comparator = comparator;
  }

  size() {
    return this.#array.length;
  }

  empty() {
    return (this.#array.length == 0);
  }
  
  add(element) {
    let idx = 0;
    for(; idx < this.#array.length; idx++) {
      if(this.#comparator(element, this.#array[idx])) {
        this.#array.splice(idx, 0, element);
        return;
      }
    }
    this.#array.splice(idx, 0, element);
    return;
  }

  peek() {
    if(this.#array.length == 0) return null;
    return this.#array[0];
  }

  poll() {
    if(this.#array.length == 0) return;
    this.#array.splice(0,1);
  }

  // prints all the elements in order of the priority queue
  printAll() {
    if(this.#array.length == 0) {
      return 'No items present.' + '\n';
    }
    
    let str = '';
    for(let i = 0; i < this.#array.length; i++) {
      str += this.#array[i].toString() + '\n';
    }
    return str;
  }

  // prints all the elements in reverse order of the priority queue
  printAllReverse() {
    if(this.#array.length == 0) {
      return 'No items present.' + '\n';
    }
    
    let str = '';
    for(let i = this.#array.length-1; i >= 0; i--) {
      str += this.#array[i].toString() + '\n';
    }
    return str;
  }  
}

class OrderBook {
  static #BIDS_COMPARATOR = function(a, b) {
    if(a.getPrice() == b.getPrice()) return a.getId() < b.getId();
    return a.getPrice() > b.getPrice();
  }
  static #ASKS_COMPARATOR = function(a, b) {
    if(a.getPrice() == b.getPrice()) return a.getId() < b.getId();
    return a.getPrice() < b.getPrice();
  }
  static VALID_TICKERS = ['CRZY', 'TAME'];
  static getTickerListString() {
    let str = '```' + '\n';
    for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
      str += OrderBook.VALID_TICKERS[i] + '\n';
    }
    str += '```';
    console.log(str);
    return str;
}

  #tickers = new Map();
  #orders = [];

  constructor() {
      for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
          this.#tickers.set(OrderBook.VALID_TICKERS[i], new class {
            bids = new PriorityQueue(OrderBook.#BIDS_COMPARATOR);
            asks = new PriorityQueue(OrderBook.#ASKS_COMPARATOR);
          });
      }
  }

  toString(ticker) {
    if(!this.#hasTicker(ticker)) return 'Invalid ticker.';

    let str = '';
    str += 'Bids:' + '\n';
    str += '```';
    str += this.#getTicker(ticker).bids.printAllReverse();
    str += '```';
    str += '\n';
    
    str += 'Asks:' + '\n';
    str += '```';
    str += this.#getTicker(ticker).asks.printAll();
    str += '```';
    return str;
  }

  
  #getTicker(ticker) {
      return this.#tickers.get(ticker);
  }
  #hasTicker(ticker) {
      return OrderBook.VALID_TICKERS.includes(ticker);
  }

  submitOrder(order, channel) {
    if(!this.#hasTicker(order.getTicker())) {
        channel.send('Invalid ticker.'); return;
    }
    traders.get(order.getUser()).addOrder(order);

    if(order.getDirection() == 'BUY') {
      switch(order.getType()) {
        case 'LIMIT': {
          channel.send(order.orderSubmittedString());
          let orderStatus = Order.NOT_FILLED;
          
          let asks = this.#getTicker(order.getTicker()).asks;
          let bids = this.#getTicker(order.getTicker()).bids;
          while(!asks.empty() && orderStatus != Order.COMPLETELY_FILLED) {
            let bestAsk = asks.peek();
            if(order.getPrice() < bestAsk.getPrice()) break;
            
            let quantityTradable = Math.min(order.getQuantityUnfilled(), bestAsk.getQuantityUnfilled());
            orderStatus = order.increaseQuantityFilled(quantityTradable, channel);
            let bestAskStatus = bestAsk.increaseQuantityFilled(quantityTradable, channel);
            if(bestAskStatus == Order.COMPLETELY_FILLED) asks.poll();
          }
          if(orderStatus != Order.COMPLETELY_FILLED) bids.add(order);

          break;
        }
        case 'MARKET':
          break;
        case 'STOPLOSS':
          break;
      }
      
    } else if(order.getDirection() == 'SELL') {
      switch(order.getType()) {
        case 'LIMIT': {
          channel.send(order.orderSubmittedString());
          let orderStatus = Order.NOT_FILLED;

          let asks = this.#getTicker(order.getTicker()).asks;
          let bids = this.#getTicker(order.getTicker()).bids;
          while(!bids.empty() && orderStatus != Order.COMPLETELY_FILLED) {
            let bestBid = bids.peek();
            if(bestBid.getPrice() < order.getPrice()) break;
            
            let quantityTradable = Math.min(order.getQuantityUnfilled(), bestBid.getQuantityUnfilled());
            orderStatus = order.increaseQuantityFilled(quantityTradable, channel);
            let bestBidStatus = bestBid.increaseQuantityFilled(quantityTradable, channel);
            if(bestBidStatus == Order.COMPLETELY_FILLED) bids.poll();
          }
          if(orderStatus != Order.COMPLETELY_FILLED) asks.add(order);
          
          break;
        }
        case 'MARKET':
          break;
        case 'STOPLOSS':
          break;
      }
    }
  }
}
let orderBook = new OrderBook();


client.once('ready', c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on('messageCreate', (msg) => {
  if(msg.author == process.env['BOT_ID']) return;

  let args = msg.content.split(' ');
  
  switch(args[0]) {
    case '!help': {
      let infoString = 
          '!help' + '\n' + 
          '!join' + '\n' + 
          '!buy [ticker] [quantity] [price]' + '\n' + 
          '!sell [ticker] [quantity] [price]' + '\n' + 
          '!orderbook [ticker]' + '\n' + 
          '!tickerlist';
      msg.channel.send('```' + infoString + '```');
      }
      break;
      
    // case '!info':
    //   if(!isValidTrader(msg.author)) return;
    //   msg.channel.send(traders.get(msg.author).toString());
    //   break;
      
    case '!join':
      if(isValidTrader(msg.author)) return;
      msg.channel.send(`${getPingString(msg.author)} You've been added to the trader list.`);
      traders.set(msg.author, new Trader(msg.author));
      break;
    
    case '!buy': {
      if(!isValidTrader(msg.author)) return;
      
      let order = new Order(msg.author, 'BUY', 'LIMIT', args[1], parseInt(args[2]), parseInt(args[3]));
      orderBook.submitOrder(order, msg.channel);
      }
      break;
      
    case '!sell': {
      if(!isValidTrader(msg.author)) return;
      
      let order = new Order(msg.author, 'SELL', 'LIMIT', args[1], parseInt(args[2]), parseInt(args[3]));
      orderBook.submitOrder(order, msg.channel);
      }
      break;
      
    case '!orderbook':
      if(!isValidTrader(msg.author)) return;
      msg.channel.send(orderBook.toString(args[1]));
      break;
    
    case '!tickerlist':
      msg.channel.send(OrderBook.getTickerListString());
      break;
    
  }
});

client.on('debug', console.log);

client.login(process.env['BOT_TOKEN']);


function getPingString(user) {
    return `<@${user.id}>`;
}
