import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
} from "chart.js";
import chartAnnotation from "chartjs-plugin-annotation";

// this modal is lazy loaded on its own, so it cannot rely on whatever else
// happens to have registered these. register is idempotent
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
  chartAnnotation,
);
