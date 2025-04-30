// index.js
import dotenv from "dotenv";
import express from "express";
dotenv.config();

const app = express();
const port = 3000;

// Service to handle route data fetching
const routeService = {
  formatearFecha: (fecha) => fecha.toISOString().split("T")[0],
  calcularSiguienteSemana: (fecha) => {
    const nuevaFecha = new Date(fecha);
    nuevaFecha.setDate(nuevaFecha.getDate() + 7);
    return nuevaFecha;
  },
  calcularSiguienteFecha: (fecha) => {
    const nuevaFecha = new Date(fecha);
    nuevaFecha.setDate(nuevaFecha.getDate() + 6);
    return nuevaFecha;
  },

  obtenerDatos: async (fechaInicioParam, fechaFinParam) => {
    try {
      let fechaInicio = new Date(fechaInicioParam ?? "2024-01-01");
      let fechaFin = new Date(fechaFinParam ?? new Date());
      const hoy = new Date();

      let fechaDesde = fechaInicio;
      let fechaHasta = routeService.calcularSiguienteFecha(fechaInicio);
      const promises = [];

      // Create array of fetch promises
      while (fechaDesde < hoy) {
        if (fechaHasta > fechaFin) {
          if (fechaHasta > hoy) {
            fechaHasta = hoy;
          } else {
            fechaHasta = fechaFin;
          }
        }

        const fechaDesdeStr = routeService.formatearFecha(fechaDesde);
        const fechaHastaStr = routeService.formatearFecha(fechaHasta);

        const promise = fetch(
          `https://saas.quadminds.com/api/v2/consolidated-routes/search?from=${fechaDesdeStr}&to=${fechaHastaStr}`,
          {
            headers: {
              "x-saas-apikey": process.env.API_KEY,
            },
          }
        );

        promises.push(promise);

        fechaDesde = routeService.calcularSiguienteSemana(fechaDesde);
        fechaHasta = routeService.calcularSiguienteSemana(fechaHasta);
      }

      const respuestas = await Promise.all(promises);

      for (const respuesta of respuestas) {
        if (!respuesta.ok) {
          throw new Error(`Error en la API: ${respuesta.status}`);
        }
      }

      const datosPromises = respuestas.map((respuesta) => respuesta.json());
      const datos = await Promise.all(datosPromises);

      const mappedResults = datos.flatMap((dato) =>
        dato.data.map((route) => {
          const { activities, collections, ...resto } = route;
          return {
            ...resto,
            waypoints:
              route.waypoints?.map((waypoint) => ({
                ...waypoint,
                ruta_id: route._id,
              })) || [],
          };
        })
      );

      return mappedResults;
    } catch (error) {
      console.error("Error al obtener los datos:", error.message);
      throw error;
    }
  },
};

// Controller
const routeController = {
  getRouteData: async (req, res) => {
    try {
      const fechaInicio = req.query.fechaInicio;
      const fechaFin = req.query.fechaFin;
      if (fechaInicio > fechaFin) {
        return res.status(400).json({
          success: false,
          error: "La fecha de inicio no puede ser mayor a la fecha de fin",
        });
      }
      const results = await routeService.obtenerDatos(fechaInicio, fechaFin);
      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

app.get("/api/routes", routeController.getRouteData);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
