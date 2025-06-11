# OOXML Field Processor (React App)

A React application for testing and demonstrating the processing of MERGEFIELD and IF fields in Word OOXML documents.

## Features

- **Interactive UI**: User-friendly interface for inputting XML and JSON data, and viewing processed output.
- **CodeMirror Integration**: Advanced text editing experience with syntax highlighting for XML and JSON.
- **MERGEFIELD Processing**: Replaces merge fields with dots (`..........`) while preserving invisible tags for LLM processing.
- **IF Field Processing**: Evaluates conditional statements and displays appropriate content based on JSON data.
- **TypeScript**: The entire application and the underlying processing library are built with TypeScript for enhanced type safety and developer experience.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have Node.js and npm (or pnpm) installed on your system.

- Node.js (LTS version recommended)
- npm (comes with Node.js) or pnpm

### Installation

1.  **Download the Application**: Download the `ooxml-tester-typescript-app.zip` file provided by the agent.
2.  **Extract the Archive**: Unzip the downloaded file to your desired directory.
3.  **Navigate to the Project Directory**: Open your terminal or command prompt and navigate into the extracted `ooxml-tester` directory.

    ```bash
    cd ooxml-tester
    ```

4.  **Install Dependencies**: Install the project dependencies. Due to potential peer dependency conflicts, it's recommended to use the `--legacy-peer-deps` flag.

    ```bash
    npm install --legacy-peer-deps
    # or if you use pnpm
    pnpm install --legacy-peer-deps
    ```

### Running the Application

To start the development server and open the application in your browser:

```bash
npm run dev
# or if you use pnpm
pnpm run dev
```

The application will typically open in your browser at `http://localhost:5173` or `http://localhost:5174`.

## Usage

Once the application is running:

1.  **XML Input**: You can either:
    *   **Upload an XML file**: Click the 

