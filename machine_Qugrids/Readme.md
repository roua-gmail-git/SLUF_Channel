# SLUF_DS Machine Qugrids Setup

This project runs with Node.js. You need one terminal for the local PMU TCP server and two more terminals for the two machine processes.

## Requirements

Run these commands on Linux before starting the project:

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v
npm -v
```

Install the project dependencies:

```bash
cd ./machine_Qugrids
npm install
```

The required npm packages are listed in `package.json`:

```bash
npm install express moment crypto readline
```

## Run the Project

Open three separate terminals and run the commands in this order.

### Terminal 1: start the local PMU TCP server

```bash
node local_TCPserver_PMU.js
```

Leave this terminal running. The PMU server listens on `127.0.0.2:5000` and starts sending PMU data to machine 2.

### Terminal 2: start machine 2

```bash
cd ./machine_Qugrids
node main2.js
```

Leave this terminal running. Machine 2 receives the PMU data, transforms it into a transaction, and sends the transaction to machine 1.

### Terminal 3: start machine 1

```bash
cd ./machine_Qugrids
node main1.js
```

Leave this terminal running. Machine 1 receives the transaction from machine 2.

## Stop the Project

Press `Ctrl+C` in each of the three terminals to stop the running processes.
