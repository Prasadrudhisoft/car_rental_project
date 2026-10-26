import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function MapFix() {
    const map = useMap();
    useEffect(() => {
        const t  = setTimeout(() => map.invalidateSize(), 250);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null;
        ro?.observe(map.getContainer());
        return () => { clearTimeout(t); ro?.disconnect(); };
    }, [map]);
    return null;
}