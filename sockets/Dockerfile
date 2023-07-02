# Use a Node.js base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the application code
COPY . .

# Build
RUN npm run build

# Expose the port used by your WebSocket server
EXPOSE 8998 8999

# Start the WebSocket server
CMD ["npm", "start"]