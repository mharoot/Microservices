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