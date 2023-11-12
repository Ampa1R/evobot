import http from 'http';
import promClient from 'prom-client';
import { config } from '../utils/config';
import { Logger } from '../utils/logger';

const PORT = config.METRICS_PORT;

export default function startMetricsServer() {
    promClient.collectDefaultMetrics();

    const server = http.createServer(async function (req, res) {
        try {
            if (req.url === '/metrics') {
                res.setHeader('Content-Type', promClient.register.contentType);
                res.write(await promClient.register.metrics());
                res.end();
                return;
            }
            res.statusCode = 404;
            res.write('Not found');
            res.end();
        } catch (err) {
            Logger.error(`Metrics server response error`);
            Logger.error(err);
            res.statusCode = 500;
            res.write('Internal server error');
            res.end();
        }
    })

    server.listen(PORT, function () {
        console.log(`Metrics server started at port ${PORT}`);
    });
}