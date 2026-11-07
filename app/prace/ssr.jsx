import { renderToString } from 'react-dom/server';
import Hero from './Hero.jsx';
export default () => renderToString(<Hero />);
