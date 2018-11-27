module.exports = {
    /**
     * 计算平均值
     *
     * @param {*} [scores=[]] 数值集合
     * @returns 平均值
     */
    computeAverage(scores = []) {
        const n = scores.length;
        let avg = 0;
        let mod = 0;

        if (n === 0) {
            return avg;
        }

        const sum = scores.reduce((pre, cur) => {
            return pre + cur;
        }, 0);

        avg = Math.floor(sum / n);
        mod = sum % n;
        if (mod >= (n / 2)) {
            avg += 1;
        }

        return avg;
    }
}