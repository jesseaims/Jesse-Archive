export type Category='login'|'card'|'note'|'personal'|'passkey'|'crypto';
export type Item={id:string;type:Category;title:string;folder?:string|null;fav?:boolean;notes?:string;f:Record<string,string>;trashed?:number|null;created?:number;updated?:number;shared?:boolean;gk?:string;src?:string};
export type Password={id:string;value:string;item_id?:string|null;item_title?:string;item_type?:string;label?:string;source?:string;created:number;linked?:number;retired?:number|null;active:boolean};
export type Folder={id:string;name:string;upd?:number};
export type Group={name:string;icon:string;src:string;upd?:number};
export type Settings={autolock?:number;clip?:number;old_days?:number;logos?:number;theme?:{preset:string;custom?:Record<string,string>}};
export type State={items:Item[];passwords:Password[];folders:Folder[];groups?:Record<string,Group>;settings:Settings;path:string;synced_at:number;prefs:{close:'quit'|'tray';autostart:boolean;win:boolean;tray_ok:boolean;native:boolean}};
export type Status={exists:boolean;unlocked:boolean;path:string};
export type Page='all'|'favorites'|'passwords'|'security'|'generator'|'trash'|'settings'|'groups'|'folder'|'login'|'passkey'|'note'|'card'|'personal'|'crypto'|'shared';
export const categories:Record<Category,{label:string;fields:string[];secret?:string}>={
login:{label:'Accesso',fields:['url','username','password','totp'],secret:'password'},
card:{label:'Carta',fields:['holder','number','expiry','cvv','pin'],secret:'pin'},
note:{label:'Nota protetta',fields:[]},
personal:{label:'Identità',fields:['fullname','email','phone','address','city','zip','country','birthday']},
passkey:{label:'Passkey',fields:['url','username','credential']},
crypto:{label:'Wallet crypto',fields:['platform','address','seed','password'],secret:'password'}};
export const labels:Record<string,string>={url:'Sito web / URL',username:'Nome utente',password:'Password',totp:'Codice TOTP (secret)',holder:'Titolare',number:'Numero carta',expiry:'Scadenza',cvv:'CVV',pin:'PIN',fullname:'Nome completo',email:'Email',phone:'Telefono',address:'Indirizzo',city:'Città',zip:'CAP',country:'Paese',birthday:'Data di nascita',credential:'Credenziale salvata',platform:'Piattaforma',seed:'Seed phrase'};
