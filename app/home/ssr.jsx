import { renderToString } from 'react-dom/server';
import App from './App.jsx';
export default () => renderToString(<App />);
