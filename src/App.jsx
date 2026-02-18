import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import CardPage from './pages/CardPage'
import GraphPage from './pages/GraphPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/card/:id" element={<CardPage />} />
            <Route path="/graph" element={<GraphPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
