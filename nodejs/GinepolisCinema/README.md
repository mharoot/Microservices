# Build a NodeJS cinema microservice and deploying it with docker — part 1

### Architecture
![alt text](https://github.com/mharoot/Microservices/blob/master/nodejs/GinepolisCinema/images/GinepolisCinemaArchitecture.png "Ginepolis Cinema Architecture")

### What will we be doing?
- The IT department of Ginepolis Cinema wants us to restructure their tickets and grovery store monolithic system to a microservice.
- So for the first part of this tutorial, we will focus on the **movies catalog service**.
- In this architecture image provided above we can see we have 3 different devices that can access the microservice.  The POS(point of sale) and the mobile/tablet have their own application (in electron) and they consumes the microservice directly, and the computer acceses the microservice through web apps.

---

# Building the Microservice
- Let us simulate a request for booking our favorite cinema for a movie premiere.
- First we want to see which movies are currently available in the cinema.  The following diagram shows us how the inner communication with microservices through REST works.

![alt text](https://github.com/mharoot/Microservices/blob/master/nodejs/GinepolisCinema/images/CatalogAndMovieServiceArchitecture.png "Catalog and Movie Service Architecture")

Our **API** for the **movies service** will have this raml specifications:
```javascript
// raml-spec/booking-service/api.raml
#%RAML 1.0
title: cinema
version: v1
baseUri: /

types:
  Movie:
    properties:
      id: string
      title: string
      runtime: number
      format: string
      plot: string
      releaseYear: number
      releaseMonth: number
      releaseDay: number
    example:
      id: "123"
      title: "Assasins Creed"
      runtime: 115
      format: "IMAX"
      plot: "Lorem ipsum dolor sit amet"
      releaseYear : 2017
      releaseMonth: 1
      releaseDay: 6

  MoviePremieres:
    type: Movie []


resourceTypes:
  Collection:
    get:
      responses:
        200:
          body:
            application/json:
              type: <<item>>

/movies:
  /premieres:
    type:  { Collection: {item : MoviePremieres } }

  /{id}:
    type:  { Collection: {item : Movie } }
```

Our **API** for the **catalog service** will have this raml specifications:
```javascript
// raml-spec/catalog-service/api.raml

#%RAML 1.0
title: Cinema Catalog Service
version: v1
baseUri: /cinemas
uses:
  object: types.raml
  stack: ../movies-service/api.raml

types:
  Countries: object.Country []
  States: object.State []
  Cities: object.City []
  Cinemas: object.Cinema []
  Movies: stack.MoviePremieres
  Schedules: object.Schedule []


resourceTypes:
  GET:
    get:
      responses:
        200:
          body:
            application/json:
              type: <<item>>


/:
  type:  { GET: {item : Cinemas } }

  /{cinema_id}:
    type:  { GET: {item : Movies } }

  /{ciyt_id}/{movie_id}:
      type:  { GET: {item : Schedules } }
```

Our **Data Types** for the **catalog service** will have this raml specifications:
```javascript
// raml-spec/catalog-service/types.raml

#%RAML 1.0 Library

types:
  Country:
    properties:
      _id: string
      name: string

  State:
    properties:
      _id: string
      name: string
      country_id: string

  City:
    properties:
      _id: string
      name: string
      state_id: string

  Location:
    properties:
      countryId: string
      stateId: string
      cityId: string

  Schedule:
    properties:
      time: string
      seatsEmpty: array
      seatsOccupied: array
      price: number
      movie_id: string

  CinemaRoom:
    properties:
      name: number
      capacity: number
      schedules: Schedule

  Cinema:
    properties:
      _id: string
      name: string
      cinemaRooms: CinemaRoom
      city_id: string
```

---

# Directory Struture per Service
![alt text](https://github.com/mharoot/Microservices/blob/master/nodejs/GinepolisCinema/images/ServiceDirectoryStructure.png "Service Directory Structure")

### Booking Service Repository
```javascript
// booking-service/src/repository/repository.js
'use strict'
const repository = (container) => {
  const {database: db} = container.cradle

  const makeBooking = (user, booking) => {
    return new Promise((resolve, reject) => {
      const payload = {
        city: booking.city,
        userType: (user.membership) ? 'loyal' : 'normal',
        totalAmount: booking.totalAmount,
        cinema: {
          name: booking.cinema,
          room: booking.cinemaRoom,
          seats: booking.seats.toString()
        },
        movie: {
          title: booking.movie.title,
          format: booking.movie.format,
          schedule: booking.schedule
        }
      }

      db.collection('booking').insertOne(payload, (err, booked) => {
        if (err) {
          reject(new Error('An error occuered registring a user booking, err:' + err))
        }
        resolve(payload)
      })
    })
  }

  const generateTicket = (paid, booking) => {
    return new Promise((resolve, reject) => {
      const payload = Object.assign({}, booking, {orderId: paid.charge.id, description: paid.description})
      db.collection('tickets').insertOne(payload, (err, ticket) => {
        if (err) {
          reject(new Error('an error occured registring a ticket, err:' + err))
        }
        resolve(payload)
      })
    })
  }

  const getOrderById = (orderId) => {
    return new Promise((resolve, reject) => {
      const ObjectID = container.resolve('ObjectID')
      const query = {_id: new ObjectID(orderId)}
      const response = (err, order) => {
        if (err) {
          reject(new Error('An error occuered retrieving a order, err: ' + err))
        }
        resolve(order)
      }
      db.collection('booking').findOne(query, {}, response)
    })
  }

  const disconnect = () => {
    db.close()
  }

  return Object.create({
    makeBooking,
    getOrderById,
    generateTicket,
    disconnect
  })
}

const connect = (container) => {
  return new Promise((resolve, reject) => {
    if (!container.resolve('database')) {
      reject(new Error('connection db not supplied!'))
    }
    resolve(repository(container))
  })
}

module.exports = Object.assign({}, {connect})
```

### Movies Service Repository
```javascript
// movies-service/src/repository/repository.js
'use strict'

const repository = (db) => {
  const collection = db.collection('movies')

  const getAllMovies = () => {
    return new Promise((resolve, reject) => {
      const movies = []
      const cursor = collection.find({}, {title: 1, id: 1})
      const addMovie = (movie) => {
        movies.push(movie)
      }
      const sendMovies = (err) => {
        if (err) {
          reject(new Error('An error occured fetching all movies, err:' + err))
        }
        resolve(movies.slice())
      }
      cursor.forEach(addMovie, sendMovies)
    })
  }

  const getMoviePremiers = () => {
    return new Promise((resolve, reject) => {
      const movies = []
      const currentDay = new Date()
      const query = {
        releaseYear: {
          $gt: currentDay.getFullYear() - 1,
          $lte: currentDay.getFullYear()
        },
        releaseMonth: {
          $gte: currentDay.getMonth() + 1,
          $lte: currentDay.getMonth() + 2
        },
        releaseDay: {
          $lte: currentDay.getDate()
        }
      }
      const cursor = collection.find(query)
      const addMovie = (movie) => {
        movies.push(movie)
      }
      const sendMovies = (err) => {
        if (err) {
          reject(new Error('An error occured fetching all movies, err:' + err))
        }
        resolve(movies)
      }
      cursor.forEach(addMovie, sendMovies)
    })
  }

  const getMovieById = (id) => {
    return new Promise((resolve, reject) => {
      const projection = { _id: 0, id: 1, title: 1, format: 1 }
      const sendMovie = (err, movie) => {
        if (err) {
          reject(new Error(`An error occured fetching a movie with id: ${id}, err: ${err}`))
        }
        resolve(movie)
      }
      collection.findOne({id: id}, projection, sendMovie)
    })
  }

  const disconnect = () => {
    db.close()
  }

  return Object.create({
    getAllMovies,
    getMoviePremiers,
    getMovieById,
    disconnect
  })
}

const connect = (connection) => {
  return new Promise((resolve, reject) => {
    if (!connection) {
      reject(new Error('connection db not supplied!'))
    }
    resolve(repository(connection))
  })
}

module.exports = Object.assign({}, {connect})
```

As you can see, each service has it's own directory within the `root directory 'GinepolisCindema/'`.  The first section to look at within each service directory is the repository.  In the file `booking-service/src/repository/repository.js` we do our querys to the database.
- Note: we provide a `connection` object to the only exposed method of the repository **connect(**`connection`**)**, you can see a powerful feature of JavaScript here, **"closures"**.  The `repository` object is returning a closure where every function has access to the `db` object and to the `collection` object.  The `db` object is holding the connection to the database.  
- Here we are abstracting the type of database we are connection to.  The repoistory object does not have to know what type of database were working with and if it is a single database or a replica set connection.  Using the mongodb synax, we can abstract the repository functions by applying the *Dependency Inversion principle* from ***solid principles***. By taking the mongodb syntax from another file, we can just call the interface of the database actions using mongoose models.
- There is a `booking-service/src/repository/repository.spec.js` file used for testing the repository.js module.
```javascript
/* eslint-env mocha */
const should = require('should');
const repository = require('./repository');

describe('Repository', () => {
  it('should connect with a promise', (done) => {
    repository.connect({}).should.be.a.Promise();
    done();
  });
});
```

For the remainder of this tutorial we will be discussing the movies service.

---

### Movies Service Server
Next we are going to look at is the 'movies-service/src/server/server.js' file:
```javascript
// server.js
const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')
const api = require('../api/movies')

const start = (options) => {
  return new Promise((resolve, reject) => {
    if (!options.repo) {
      reject(new Error('The server must be started with a connected repository'))
    }
    if (!options.port) {
      reject(new Error('The server must be started with an available port'))
    }

    const app = express()
    app.use(morgan('dev'))
    app.use(helmet())
    app.use((err, req, res, next) => {
      reject(new Error('Something went wrong!, err:' + err))
      res.status(500).send('Something went wrong!')
    })

    api(app, options)

    const server = app.listen(options.port, () => resolve(server))
  })
}

module.exports = Object.assign({}, {start})



// it's associated test file server.spec.js

/* eslint-env mocha */
const server = require('./server')

describe('Server', () => {
  it('should require a port to start', () => {
    return server.start({
      repo: {}
    }).should.be.rejectedWith(/port/)
  })

  it('should require a repository to start', () => {
    return server.start({
      port: {}
    }).should.be.rejectedWith(/repository/)
  })
})
```
In server.js we instantiate a new express app, verify provided repository and server port objects, then we apply some middleware to our express app:
- `morgan` for loggin
- `helmet` for security, *Helmet includes 11 packages that all work to block malicious parties from breaking or using an application to hurt it's users*
- `error handling function`
- [Nine Security Tip for Express *optional*](https://nodesource.com/blog/nine-security-tips-to-keep-express-from-getting-pwned)

---

# Movies Service API
Now since our Movies Service Server is using our movieAPI, let us examine the file *`movies-service/src/api/movie.js`*:
```javascript
// movies.js
'use strict'
const status = require('http-status')

module.exports = (app, options) => {
  const {repo} = options

  app.get('/movies', (req, res, next) => {
    repo.getAllMovies().then(movies => {
      res.status(status.OK).json(movies)
    }).catch(next)
  })

  app.get('/movies/premieres', (req, res, next) => {
    repo.getMoviePremiers().then(movies => {
      res.status(status.OK).json(movies)
    }).catch(next)
  })

  app.get('/movies/:id', (req, res, next) => {
    repo.getMovieById(req.params.id).then(movie => {
      res.status(status.OK).json(movie)
    }).catch(next)
  })
}
```

Let us continute with how to create the `db connection` object we passed to the **repository module**.  By defintion, every microservice has to have it's own database.  In this tutorial we are going to use a **mongoDB replica set server**.

---

# Movies Service Configuration
- Here we are using an `event-mediator` objet that will emit the `db` object when we pass the authentication proccess.
- *The promise approach for some reason did not return the db object once it passed the authentication, the sequence becomes idle.  Challenge: try to use a promise approach or find out why it won't work here.*
```javascript
// movies-service/src/config/mongo.js
const MongoClient = require('mongodb')
 
const getMongoURL = (options) => {
  const url = options.servers
    .reduce((prev, cur) => prev + cur + ',', 'mongodb://')

  return `${url.substr(0, url.length - 1)}/${options.db}`
}

const connect = (options, mediator) => {
  mediator.once('boot.ready', () => {
    MongoClient.connect(
      getMongoURL(options), {
        db: options.dbParameters(),
        server: options.serverParameters(),
        replset: options.replsetParameters(options.repl)
      }, (err, db) => {
        if (err) {
          mediator.emit('db.error', err)
        }

        db.admin().authenticate(options.user, options.pass, (err, result) => {
          if (err) {
            mediator.emit('db.error', err)
          }
          mediator.emit('db.ready', db)
        })
      })
  })
}

module.exports = Object.assign({}, {connect})
```
```javascript
// movies-service/src/config/config.js
const dbSettings = {
  db: process.env.DB || 'movies',
  user: process.env.DB_USER || 'michael',
  pass: process.env.DB_PASS || 'michaelPassword2017',
  repl: process.env.DB_REPLS || 'rs1',
  servers: (process.env.DB_SERVERS) ? process.env.DB_SERVERS.split(' ') : [
    '192.168.99.100:27017',
    '192.168.99.101:27017',
    '192.168.99.102:27017'
  ],
  dbParameters: () => ({
    w: 'majority',
    wtimeout: 10000,
    j: true,
    readPreference: 'ReadPreference.SECONDARY_PREFERRED',
    native_parser: false
  }),
  serverParameters: () => ({
    autoReconnect: true,
    poolSize: 10,
    socketoptions: {
      keepAlive: 300,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000
    }
  }),
  replsetParameters: (replset = 'rs1') => ({
    replicaSet: replset,
    ha: true,
    haInterval: 10000,
    poolSize: 10,
    socketoptions: {
      keepAlive: 300,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000
    }
  })
}

const serverSettings = {
  port: process.env.PORT || 3000,
  ssl: require('./ssl')
}

module.exports = Object.assign({}, { dbSettings, serverSettings })
```
---

# Movie Services - Putting it all together 
```javascript
// movies-service/src/index.js
'use strict'
const {EventEmitter} = require('events')
const server = require('./server/server')
const repository = require('./repository/repository')
const config = require('./config/')
const mediator = new EventEmitter()

console.log('--- Movies Service ---')
console.log('Connecting to movies repository...')

process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception', err)
})

process.on('uncaughtRejection', (err, promise) => {
  console.error('Unhandled Rejection', err)
})

mediator.on('db.ready', (db) => {
  let rep
  repository.connect(db)
    .then(repo => {
      console.log('Connected. Starting Server')
      rep = repo
      return server.start({
        port: config.serverSettings.port,
        ssl: config.serverSettings.ssl,
        repo
      })
    })
    .then(app => {
      console.log(`Server started succesfully, running on port: ${config.serverSettings.port}.`)
      app.on('close', () => {
        rep.disconnect()
      })
    })
})

mediator.on('db.error', (err) => {
  console.error(err)
})

config.db.connect(config.dbSettings, mediator)

mediator.emit('boot.ready')
```
- Here we are composing all the movies API service, we have a litte bit of error handling, then we are loading the configurations, starting the repository, and finally starting the server.