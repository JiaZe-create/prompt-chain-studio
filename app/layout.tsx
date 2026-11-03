import type {Metadata} from 'next';
import './globals.css';
import Theme from './theme';
export const metadata:Metadata={title:'Prompt Chain Studio',description:'Build, arrange, and run creative prompt chains.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Theme/>{children}</body></html>}
