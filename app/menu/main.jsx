import { hydrateRoot } from 'react-dom/client';
import Menu from './Menu.jsx';

// the menu is in the page from the build (plain links work at once); here it comes alive (the liquid hover)
const el = document.getElementById('gm');
if (el) hydrateRoot(el, <Menu active={Number(el.dataset.active)} />);
