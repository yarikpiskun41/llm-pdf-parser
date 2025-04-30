# PDF Parser


**API URL:** `http://localhost:{PORT}/api`

## SETUP

Use the **.env.example** file to create a **.env** file in the same folder, and fill in the required fields.

### Docker Run
- Fill the `.env`, `.env.client`, files using the `.env.example` and `.env.client.example`  templates
- Use the Docker Compose file to start the app.
- Use PC with GPU or reconfigure the docker-compose.yml

### To local run
- Fill the `.env` files using the `.env.example` in both the `client` and `server` folders,
- install the dependencies in both the `client` and `server` folders
#### Client
```
npm run build # Builds the app
```

**OR**
```
npm run dev # Runs the app in development mode
```

#### Server
```
# To build and run the app
npm run start
```

**OR**
```
# To run the app in development mode
npm run dev
```

