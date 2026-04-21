public class Ex05 {
    public static void main(String[] args) {
        int numero = 1221;

        // Garante que o número tem exatamente 4 dígitos positivos
        if (numero < 1000 || numero > 9999) {
            System.out.println("Entrada inválida. Digite um número de 4 dígitos.");
        } else {
            int milhar = numero / 1000;
            int centena = (numero / 100) % 10;
            int dezena = (numero / 10) % 10;
            int unidade = numero % 10;

            if (milhar == unidade && centena == dezena) {
                System.out.println(numero + " é um palíndromo!");
            } else {
                System.out.println(numero + " não é palíndromo.");
            }
        }
    }
}