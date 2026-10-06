# Dato de informalidad del INEC (opcional)

Si existe `informalidad.csv` en esta carpeta, el aviso de las páginas de empleo dice qué parte del empleo es
informal, con su fuente. Una sola fila, copiada de la Encuesta de Mercado Laboral del INEC:

```csv
porcentaje,periodo,fuente,url
PORCENTAJE,MES Y AÑO,el INEC (Encuesta de Mercado Laboral),URL DEL CUADRO
```

Escribe el porcentaje con punto decimal (por ejemplo 45.2) o entre comillas si usas coma. Sin este archivo el aviso no da ninguna cifra.
