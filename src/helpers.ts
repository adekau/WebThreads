export const fnToURL = (func: Function | string) => {
    const strFn: string = func.toString();
    const fnBody: string = strFn
        .substring(
            strFn.indexOf('{') + 1,
            strFn.lastIndexOf('}')
        );

    const blob = new Blob(
        [fnBody], {
            type: 'text/javascript'
        });

    return URL.createObjectURL(blob);
}
