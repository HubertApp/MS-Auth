import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';

// Instrumentations ciblées plutôt que getNodeAutoInstrumentations() : ce
// dernier installe des dizaines de packages (mongodb, redis, kafka, aws-sdk,
// ...) qu'on n'utilise jamais ici, ce qui alourdit "npm ci" de plusieurs
// minutes pour rien. Seuls http/express/graphql sont réellement utilisés par
// MS-Auth.
export const otelSDK = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new GraphQLInstrumentation({
      mergeItems: true,
      depth: 2,
    }),
  ],
});
