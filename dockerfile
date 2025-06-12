# Use Node.js base image
FROM node:22

# Set working directory
WORKDIR /app

# Copy dependencies files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the project
COPY . .

# Optional: if you use TypeScript
RUN npm run build

# Set environment variables if needed (can be overridden by docker-compose or CLI)
ENV NODE_ENV=production

# Command to run your bot
CMD ["npm", "start"]