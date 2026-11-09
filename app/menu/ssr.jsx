import { renderToString } from 'react-dom/server';
import Menu from './Menu.jsx';

export default active => renderToString(<Menu active={active} />);
