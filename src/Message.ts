export type Message =
    (
        | {
            type: 'result';
            result: unknown;
        }
        | {
            type: 'error';
            error: unknown;
        }
        | {
            type: 'run';
            func: string;
            [k: string]: any;
        }
    )
    & {
        id: number;
    };
