import React, { useState } from 'react';
import './styles/index.css';
import NavigationBar from './components/NavigationBar';
import HeroSection from './components/HeroSection';
import InputSection from './components/InputSection';
import ResultSection from './components/ResultSection';

const FashionAI = () => {
    const [image, setImage] = useState(null);
    const [results, setResults] = useState([]);

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImage(URL.createObjectURL(file));
            // Add logic to send the image to the Flask backend
        }
    };

    const fetchResults = async () => {
        // Add logic to fetch results from the Flask backend
    };

    return (
        <div className="app-container">
            <NavigationBar />
            <HeroSection />
            <div className="content-grid">
                <InputSection onImageUpload={handleImageUpload} />
                <ResultSection results={results} />
            </div>
        </div>
    );
};

export default FashionAI;