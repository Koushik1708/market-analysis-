interface TreeNode {
  isLeaf: boolean;
  prediction?: number;
  featureIndex?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
}

export class DecisionTreeRegressor {
  private root: TreeNode | null = null;
  private maxDepth: number;
  private minSamplesSplit: number;

  constructor(maxDepth: number = 5, minSamplesSplit: number = 2) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
  }

  public fit(X: number[][], y: number[]) {
    this.root = this.buildTree(X, y, 0);
  }

  public predict(X: number[][]): number[] {
    return X.map(x => this.predictOne(x, this.root));
  }

  private predictOne(x: number[], node: TreeNode | null | undefined): number {
    if (!node) return 0;
    if (node.isLeaf) return node.prediction || 0;
    
    if (x[node.featureIndex as number] <= (node.splitValue as number)) {
      return this.predictOne(x, node.left);
    } else {
      return this.predictOne(x, node.right);
    }
  }

  private buildTree(X: number[][], y: number[], depth: number): TreeNode {
    const numSamples = X.length;
    const numFeatures = X[0]?.length || 0;

    let variance = this.calculateVariance(y);
    
    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit || variance === 0) {
      return { isLeaf: true, prediction: this.mean(y) };
    }

    let bestSplit = this.getBestSplit(X, y, numFeatures);

    if (bestSplit.bestScore === Infinity) {
      return { isLeaf: true, prediction: this.mean(y) };
    }

    const { bestFeature, bestVal, leftIndices, rightIndices } = bestSplit;

    const leftNode = this.buildTree(
      leftIndices.map(i => X[i]),
      leftIndices.map(i => y[i]),
      depth + 1
    );

    const rightNode = this.buildTree(
      rightIndices.map(i => X[i]),
      rightIndices.map(i => y[i]),
      depth + 1
    );

    return {
      isLeaf: false,
      featureIndex: bestFeature,
      splitValue: bestVal,
      left: leftNode,
      right: rightNode
    };
  }

  private getBestSplit(X: number[][], y: number[], numFeatures: number) {
    let bestFeature = -1;
    let bestVal = 0;
    let bestScore = Infinity;
    let leftIndices: number[] = [];
    let rightIndices: number[] = [];

    // Optional: for Random Forest we can sample features here (m = sqrt(numFeatures))
    // but for small datasets, splitting all is fine, or we do it outside.

    for (let featureIndex = 0; featureIndex < numFeatures; featureIndex++) {
      // Get unique values to test splits
      const values = Array.from(new Set(X.map(row => row[featureIndex])));
      values.sort((a, b) => a - b);

      for (let i = 0; i < values.length - 1; i++) {
        const splitVal = (values[i] + values[i + 1]) / 2;
        
        const currentLeft: number[] = [];
        const currentRight: number[] = [];
        
        for (let j = 0; j < X.length; j++) {
          if (X[j][featureIndex] <= splitVal) currentLeft.push(j);
          else currentRight.push(j);
        }

        if (currentLeft.length === 0 || currentRight.length === 0) continue;

        const leftY = currentLeft.map(idx => y[idx]);
        const rightY = currentRight.map(idx => y[idx]);
        
        const score = this.calculateMSE(leftY, rightY);

        if (score < bestScore) {
          bestScore = score;
          bestFeature = featureIndex;
          bestVal = splitVal;
          leftIndices = currentLeft;
          rightIndices = currentRight;
        }
      }
    }

    return { bestFeature, bestVal, bestScore, leftIndices, rightIndices };
  }

  private mean(arr: number[]) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private calculateVariance(arr: number[]) {
    if (arr.length < 2) return 0;
    const m = this.mean(arr);
    let sumSq = 0;
    for (const val of arr) sumSq += (val - m) ** 2;
    return sumSq / arr.length;
  }

  private calculateMSE(leftY: number[], rightY: number[]) {
    const leftVar = this.calculateVariance(leftY) * leftY.length;
    const rightVar = this.calculateVariance(rightY) * rightY.length;
    return leftVar + rightVar;
  }
}

export class RandomForestRegressor {
  private trees: DecisionTreeRegressor[] = [];
  private nEstimators: number;
  private maxDepth: number;

  constructor(nEstimators: number = 10, maxDepth: number = 5) {
    this.nEstimators = nEstimators;
    this.maxDepth = maxDepth;
  }

  public fit(X: number[][], y: number[]) {
    this.trees = [];
    const n = X.length;

    for (let i = 0; i < this.nEstimators; i++) {
      // Bootstrapping (sampling with replacement)
      const XSubset: number[][] = [];
      const ySubset: number[] = [];
      
      for (let j = 0; j < n; j++) {
        const randomIndex = Math.floor(Math.random() * n);
        XSubset.push(X[randomIndex]);
        ySubset.push(y[randomIndex]);
      }

      const tree = new DecisionTreeRegressor(this.maxDepth);
      tree.fit(XSubset, ySubset);
      this.trees.push(tree);
    }
  }

  public predict(X: number[][]): number[] {
    const allPredictions = this.trees.map(tree => tree.predict(X));
    // Average across all trees
    const result: number[] = [];
    for (let i = 0; i < X.length; i++) {
      let sum = 0;
      for (let j = 0; j < this.trees.length; j++) {
        sum += allPredictions[j][i];
      }
      result.push(sum / this.trees.length);
    }
    return result;
  }
}

export class GradientBoostingRegressor {
  private trees: DecisionTreeRegressor[] = [];
  private learningRate: number;
  private nEstimators: number;
  private maxDepth: number;
  private initialPrediction: number = 0;

  constructor(nEstimators: number = 10, learningRate: number = 0.1, maxDepth: number = 3) {
    this.nEstimators = nEstimators;
    this.learningRate = learningRate;
    this.maxDepth = maxDepth;
  }

  public fit(X: number[][], y: number[]) {
    this.trees = [];
    
    // Initial prediction is the mean of y
    if (y.length === 0) return;
    this.initialPrediction = y.reduce((a, b) => a + b, 0) / y.length;
    
    let currentPredictions = Array(y.length).fill(this.initialPrediction);

    for (let i = 0; i < this.nEstimators; i++) {
      // Calculate pseudo-residuals (negative gradient of MSE)
      const residuals = y.map((val, idx) => val - currentPredictions[idx]);
      
      const tree = new DecisionTreeRegressor(this.maxDepth);
      tree.fit(X, residuals);
      this.trees.push(tree);
      
      const treePredictions = tree.predict(X);
      
      // Update predictions
      for (let j = 0; j < y.length; j++) {
        currentPredictions[j] += this.learningRate * treePredictions[j];
      }
    }
  }

  public predict(X: number[][]): number[] {
    const result = Array(X.length).fill(this.initialPrediction);
    for (const tree of this.trees) {
      const treePreds = tree.predict(X);
      for (let i = 0; i < X.length; i++) {
        result[i] += this.learningRate * treePreds[i];
      }
    }
    return result;
  }
}
