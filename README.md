# HLS Multiviewer

A powerful and flexible multiviewer application for monitoring multiple HLS (HTTP Live Streaming) video streams simultaneously.

## Features

- Display up to 25 concurrent video streams in a responsive grid layout
- Support for HLS (HTTP Live Streaming) video format
- Real-time audio visualization for each stream
- Add, edit, and delete streams with persistent storage
- Global mute/unmute functionality that keeps visualizers active
- Stream health alerting with blinking borders and audible alarms for fatal playback errors or prolonged audio silence
- Automatic retry/recovery for HLS streams after failures
- Fullscreen mode for immersive viewing
- Dark theme for better visibility in low-light environments
- Cross-device synchronization of stream data

## Technologies Used

- Next.js
- React
- TypeScript
- Tailwind CSS
- HLS.js
- Web Audio API

## Installation

1. Clone the repository:
   
```
git clone https://github.com/visual-alchemy/hls-multiviewer.git
```

2. Navigate to the project directory:
   
```
cd hls-multiviewer
```

3. Install dependencies:

```
npm install
```

if you found issue for instaling dependency’s use these instead

```
npm install --legacy-peer-deps
```

## Usage

1. Start the development server:
```
npm run dev

```

2. Open your browser and visit `http://localhost:3000`

3. Use the "+" button to add new streams, providing a title and HLS URL for each.

4. Interact with individual streams using the on-screen controls.

5. Use the global controls at the top for mute/unmute and fullscreen mode.

## Building for Production

1. Build the project:
```
npm run build
```

2. Start the production server:
```
npm start
```

## Running with Docker

1. Build the Docker image:
```
docker build -t hls-multiviewer .
```

2. Run the Docker container:
```
docker run -d -p 3111:3111 hls-multiviewer
```

3. Open your browser and visit `http://localhost:3111`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [Apache 2.0 License](https://github.com/visual-alchemy/hls-multiviewer-v13/blob/main/LICENSE.txt).
