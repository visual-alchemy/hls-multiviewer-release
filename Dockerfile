# Use the official Node.js 18 image as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
# Using --legacy-peer-deps as suggested in README.md
RUN npm install --legacy-peer-deps

# Copy the rest of the application's source code
COPY . .

# Build the Next.js application for production
RUN npm run build

# Expose port 3111 to the outside world
EXPOSE 3111

# Command to run the application
CMD ["npm", "start"]
