public class Exercicio4 {
    public static void main(String[] args) {
        double ladoA = 5.0;
        double ladoB = 5.0;
        double ladoC = 8.0;

        // Validação de existência do triângulo
        if (ladoA + ladoB <= ladoC || ladoA + ladoC <= ladoB || ladoB + ladoC <= ladoA) {
            System.out.println("Os valores informados não formam um triângulo.");
        } else if (ladoA == ladoB && ladoB == ladoC) {
            System.out.println("Triângulo Equilátero");
        } else if (ladoA == ladoB || ladoB == ladoC || ladoA == ladoC) {
            System.out.println("Triângulo Isósceles");
        } else {
            System.out.println("Triângulo Escaleno");
        }
    }
}