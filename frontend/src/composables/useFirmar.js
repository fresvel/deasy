import { ref } from 'vue';

const isFirmarActivo = ref(false);

export function useFirmar() {
    const toggleFirmar = () => {
        isFirmarActivo.value = !isFirmarActivo.value;
    };

    const setFirmarActivo = (val) => {
        isFirmarActivo.value = val;
    };

    return {
        isFirmarActivo,
        toggleFirmar,
        setFirmarActivo
    };
}