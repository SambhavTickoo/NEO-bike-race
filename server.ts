import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Game state (in-memory for this session)
  const players: Record<string, any> = {};

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    // Initial state
    socket.emit('players', players);

    socket.on('join', (playerData) => {
      players[socket.id] = {
        id: socket.id,
        name: playerData.name || 'Anonymous',
        x: 0,
        y: 0,
        rotation: 0,
        color: playerData.color || '#ff00ff',
        bikeType: playerData.bikeType || 'STANDARD'
      };
      io.emit('player_joined', players[socket.id]);
    });

    socket.on('update', (data) => {
      if (players[socket.id]) {
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
        players[socket.id].rotation = data.rotation;
        players[socket.id].bikeType = data.bikeType || players[socket.id].bikeType;
        // Broadcast to everyone else
        socket.broadcast.emit('player_updated', players[socket.id]);
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      delete players[socket.id];
      io.emit('player_left', socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
