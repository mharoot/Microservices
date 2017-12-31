# Build a NodeJS cinema microservice and deploying it with docker — part 1

---

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
