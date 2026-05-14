import React from 'react';
import Classify from './Classify';
import Recommend from './Recommend';
import ColorAnalysis from './ColorAnalysis';
import Search from './Search';

const IndexPage = () => {
    return (
        <div>
            <Classify />
            <Recommend />
            <ColorAnalysis />
            <Search />
        </div>
    );
};

export default IndexPage;