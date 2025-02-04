# HLS Multiviewer

This project is a multiviewer application for streaming media, built with Next.js and Express.js.

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd hls-multiviewer
```

### 2. Install dependencies for the client (Next.js app)

```bash
npm install
```

### 3. Install dependencies for the server

```bash
cd server
npm init -y
npm install express cors ws axios
cd ..
```

### 4. Create a `package.json` file for the server

In the `server` directory, create a `package.json` file with the following content:

```json
{
  "name": "hls-multiviewer-server",
  "version": "1.0.0",
  "description": "Server for HLS Multiviewer",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "cors": "^2.8.5",
    "ws": "^7.4.6",
    "axios": "^0.21.1"
  }
}
```

## Running the Application

### 1. Start the server

In one terminal:

```bash
cd server
npm start
```

### 2. Start the Next.js development server

In another terminal:

```bash
npm run dev
```

The application should now be running. Open your browser and navigate to `http://localhost:3000` to view the multiviewer.

## Note

Make sure both the client and server are running simultaneously for the application to work correctly.

To run this project on your local machine, follow these steps:

1. Make sure you have Node.js (v14 or later) and npm (v6 or later) installed on your machine.
2. Clone the project repository to your local machine.
3. Open a terminal and navigate to the project root directory.
4. Install the client-side dependencies:

```plaintext
npm install
```


5. Create a `server` directory in the project root and navigate to it:

```plaintext
mkdir server
cd server
```


6. Initialize a new npm project in the server directory:

```plaintext
npm init -y
```


7. Install the server-side dependencies:

```plaintext
npm install express cors ws axios
```


8. Create an `index.js` file in the `server` directory and copy the server code provided earlier into this file.
9. Update the `package.json` file in the `server` directory as shown in the README.md above.
10. Navigate back to the project root directory:

```plaintext
cd ..
```


11. Start the server:

```plaintext
cd server
npm start
```


12. Open a new terminal window, navigate to the project root directory, and start the Next.js development server:

```plaintext
npm run dev
```


13. Open your web browser and go to `http://localhost:3000` to view the application.


Make sure both the client (Next.js) and server (Express.js) are running simultaneously for the application to work correctly.

This setup should allow you to run the HLS Multiviewer project on your local machine. The client will run on port 3000, and the server will run on port 3001. The WebSocket connection and API calls are configured to use these ports by default.

