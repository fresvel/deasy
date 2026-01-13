import { ref } from "vue"

//import axios from "axios";
class LayoutService {
    constructor(){
        this.menu=ref({})
        this.header=ref({})
        this.avatar=ref({})
        this.show_menu=ref({})
        this.show_message=ref({})
        this.onHeaderClick = this.onHeaderClick.bind(this);
    }   


    toggleMenu () {
        this.show_menu.value = !this.show_menu.value;
    }
    
    toggleMessages () {
        this.show_message.value = !this.show_message.value;
    }
    getLayoutData(){
        return {
            menu:this.menu,
            header:this.header,
            avatar:this.avatar,
            show_menu:this.show_menu,
            show_message:this.show_message
        }
    }
    async getHeader() {
        
        this.menu.value={
            username: 'ELiana Viscarra',
            roles:[
                {
                name: "Coordinación de Carrera",
                jobs:[
                    "Logros Académicos",
                    "Horarios de Clase",
                    "Necesidades Formativas"
                ]
                },
                {
                name: "Tutorías & Mentorías",
                jobs:[
                    "Informe de Final",
                    "Informe Parcial",
                ]
                }
            ]
        }

    }
    async getMenu() {

        this.header.value=[
            {name:"Academia", active:true, route:"academia"},
            {name:"Investigación", active:false, route:"investigacion"},
            {name:"Vinculación", active:false, route:"vinculacion"}
            ]
    }

    async getAvatar() {
        this.avatar.value={
            src: '/images/avatar.png',
            enable: 'User avatar'
        }
    }

    onHeaderClick(event){
        switch (event) {
            case 'menu':
                this.toggleMenu();
                break;
            case 'message':
                this.toggleMessages();
                break;
            case 'signer':
                break;
            default:
                alert(event);
                break;
        }
    }


}

export default LayoutService;