# Use a Node.js base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the application code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the port used by Next.js
EXPOSE 3000

# Start the Next.js server
CMD ["npm", "start"]